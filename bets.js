// ===== BETS.JS - BETTING SYSTEM =====

// Betting constants
const DRAW_TYPES = {
    main: { name: 'Main Draw', price: 50, interval: 4 * 60 * 60 * 1000, maxMultiplier: 10 },
    weekend: { name: 'Weekend Special', price: 200, maxMultiplier: 20 },
    mini: { name: 'Quick Draw', price: 25, interval: 30 * 60 * 1000, maxMultiplier: 5 }
};

const BET_STATUS = {
    PENDING: 'pending',
    WON: 'won',
    LOST: 'lost',
    CANCELLED: 'cancelled'
};

const MULTIPLIER_ODDS = {
    1: 0.9,   // 90% chance
    2: 0.7,   // 70% chance
    5: 0.4,   // 40% chance
    10: 0.2,  // 20% chance
    20: 0.1   // 10% chance
};

// ===== BET PROCESSING =====

// Process a new bet
function processBet(betData) {
    try {
        if (!isUserLoggedIn()) {
            showNotification('Please login to place bets!', 'error');
            return false;
        }
        
        const user = getCurrentUser();
        if (!user) return false;
        
        // Validate bet data
        if (!validateBetData(betData)) {
            return false;
        }
        
        // Check user balance
        if (user.balance < betData.totalCost) {
            showNotification('Insufficient balance!', 'error');
            return false;
        }
        
        // Deduct bet amount from balance
        if (!deductMoneyFromBalance(betData.totalCost, 'bet', betData)) {
            return false;
        }
        
        // Add bet to user's bet history
        const bet = {
            ...betData,
            userId: user.id,
            status: BET_STATUS.PENDING,
            timestamp: new Date().toISOString(),
            processedAt: null,
            winningNumber: null,
            payout: 0
        };
        
        if (addBetToHistory(bet)) {
            // Track betting event
            trackUserEvent('bet_placed', {
                drawType: bet.drawType,
                amount: bet.betAmount,
                multiplier: bet.multiplier,
                selectedNumber: bet.selectedNumber,
                vipLevel: user.vipLevel
            });
            
            // Schedule bet processing if it's a mini draw
            if (bet.drawType === 'mini') {
                scheduleBetProcessing(bet, 30000); // Process after 30 seconds
            }
            
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('Error processing bet:', error);
        showNotification('Failed to place bet. Please try again.', 'error');
        return false;
    }
}

// Validate bet data
function validateBetData(betData) {
    // Check required fields
    if (!betData.drawType || !DRAW_TYPES[betData.drawType]) {
        showNotification('Invalid draw type!', 'error');
        return false;
    }
    
    if (betData.selectedNumber < 0 || betData.selectedNumber > 9) {
        showNotification('Selected number must be between 0-9!', 'error');
        return false;
    }
    
    if (betData.betAmount <= 0) {
        showNotification('Bet amount must be positive!', 'error');
        return false;
    }
    
    if (betData.multiplier <= 0 || betData.multiplier > DRAW_TYPES[betData.drawType].maxMultiplier) {
        showNotification(`Invalid multiplier for ${betData.drawType} draw!`, 'error');
        return false;
    }
    
    return true;
}

// Add bet to user's history
function addBetToHistory(bet) {
    try {
        const user = getCurrentUser();
        if (!user) return false;
        
        // Get existing bets
        let bets = getStoredData('user_bets_' + user.id, []);
        
        // Add new bet at the beginning
        bets.unshift(bet);
        
        // Keep only last 1000 bets
        if (bets.length > 1000) {
            bets.splice(1000);
        }
        
        // Save bets
        setStoredData('user_bets_' + user.id, bets);
        
        return true;
        
    } catch (error) {
        console.error('Error adding bet to history:', error);
        return false;
    }
}

// ===== BET HISTORY MANAGEMENT =====

// Get user bets with filters
function getUserBets(filters = {}) {
    const user = getCurrentUser();
    if (!user) return [];
    
    let bets = getStoredData('user_bets_' + user.id, []);
    
    // Apply filters
    if (filters.status) {
        bets = bets.filter(bet => bet.status === filters.status);
    }
    
    if (filters.drawType) {
        bets = bets.filter(bet => bet.drawType === filters.drawType);
    }
    
    if (filters.dateFrom) {
        const dateFrom = new Date(filters.dateFrom);
        bets = bets.filter(bet => new Date(bet.timestamp) >= dateFrom);
    }
    
    if (filters.dateTo) {
        const dateTo = new Date(filters.dateTo);
        bets = bets.filter(bet => new Date(bet.timestamp) <= dateTo);
    }
    
    if (filters.limit) {
        bets = bets.slice(0, filters.limit);
    }
    
    return bets;
}

// Get active (pending) bets
function getActiveBets() {
    return getUserBets({ status: BET_STATUS.PENDING });
}

// Get betting statistics
function getBettingStats() {
    const allBets = getUserBets();
    const activeBets = getActiveBets();
    
    let totalWinnings = 0;
    let totalBets = 0;
    let wonBets = 0;
    let lostBets = 0;
    
    allBets.forEach(bet => {
        totalBets += bet.totalCost;
        
        if (bet.status === BET_STATUS.WON) {
            totalWinnings += bet.payout;
            wonBets++;
        } else if (bet.status === BET_STATUS.LOST) {
            lostBets++;
        }
    });
    
    const winRate = allBets.length > 0 ? ((wonBets / (wonBets + lostBets)) * 100).toFixed(1) : 0;
    
    return {
        totalBets: allBets.length,
        activeBets: activeBets.length,
        wonBets,
        lostBets,
        totalWinnings,
        totalSpent: totalBets,
        netProfit: totalWinnings - totalBets,
        winRate: winRate + '%'
    };
}

// ===== BET PROCESSING & RESULTS =====

// Process bet result
function processBetResult(bet, winningNumber) {
    try {
        const isWinner = checkWinningNumber(bet.selectedNumber, winningNumber);
        const payout = isWinner ? bet.potentialWin : 0;
        
        // Update bet status
        bet.status = isWinner ? BET_STATUS.WON : BET_STATUS.LOST;
        bet.winningNumber = winningNumber;
        bet.payout = payout;
        bet.processedAt = new Date().toISOString();
        
        // Update bet in history
        updateBetInHistory(bet);
        
        // If winner, add payout to balance
        if (isWinner && payout > 0) {
            addMoneyToBalance(payout, 'win', {
                betId: bet.id,
                drawType: bet.drawType,
                winningNumber: winningNumber
            });
            
            // Play win sound and show celebration
            playSound('win');
            showNotification(`🎉 Congratulations! You won ₹${formatNumber(payout)}!`, 'success');
            
            // Add celebration effect
            addAnimation('userBalance', 'jackpot-animation');
            
        } else {
            // Play lose sound
            playSound('lose');
            showNotification(`Better luck next time! Winning number was ${winningNumber}`, 'info');
        }
        
        // Track result
        trackUserEvent('bet_result', {
            betId: bet.id,
            drawType: bet.drawType,
            selectedNumber: bet.selectedNumber,
            winningNumber: winningNumber,
            isWinner: isWinner,
            payout: payout,
            multiplier: bet.multiplier
        });
        
        return true;
        
    } catch (error) {
        console.error('Error processing bet result:', error);
        return false;
    }
}

// Update bet in history
function updateBetInHistory(updatedBet) {
    try {
        const user = getCurrentUser();
        if (!user) return false;
        
        let bets = getStoredData('user_bets_' + user.id, []);
        const betIndex = bets.findIndex(bet => bet.id === updatedBet.id);
        
        if (betIndex !== -1) {
            bets[betIndex] = updatedBet;
            setStoredData('user_bets_' + user.id, bets);
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('Error updating bet in history:', error);
        return false;
    }
}

// Schedule bet processing (for mini draws)
function scheduleBetProcessing(bet, delay = 30000) {
    setTimeout(() => {
        // Generate winning number
        const winningNumber = generateWinningNumber();
        
        // Process result with some randomness based on multiplier odds
        const winChance = MULTIPLIER_ODDS[bet.multiplier] || 0.1;
        const isActualWinner = Math.random() < winChance;
        
        // If should be winner, use selected number as winning number
        const finalWinningNumber = isActualWinner ? bet.selectedNumber : winningNumber;
        
        processBetResult(bet, finalWinningNumber);
        
        // Refresh UI if on betting page
        if (window.location.pathname.includes('betting')) {
            loadActiveBets();
            loadBetHistory();
            loadBettingStats();
        }
        
    }, delay);
}

// ===== UI LOADING FUNCTIONS =====

// Load betting statistics
function loadBettingStats() {
    const stats = getBettingStats();
    
    const elements = {
        activeBets: stats.activeBets,
        totalWinnings: formatCurrency(stats.totalWinnings),
        winRate: stats.winRate,
        nextDraw: getCountdownToNextDraw('main')
    };
    
    Object.keys(elements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = elements[id];
        }
    });
}

// Load active bets display
function loadActiveBets() {
    const activeBetsList = document.getElementById('activeBetsList');
    if (!activeBetsList) return;
    
    const activeBets = getActiveBets();
    
    if (activeBets.length === 0) {
        activeBetsList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.6);">
                <p>🎯 No active bets</p>
                <small>Place a bet to see it here</small>
            </div>
        `;
        return;
    }
    
    activeBetsList.innerHTML = '';
    
    activeBets.forEach(bet => {
        const betElement = createBetElement(bet);
        activeBetsList.appendChild(betElement);
    });
}

// Load bet history display
function loadBetHistory() {
    const betHistoryList = document.getElementById('betHistoryList');
    if (!betHistoryList) return;
    
    const bets = getUserBets({ limit: 20 });
    
    if (bets.length === 0) {
        betHistoryList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.6);">
                <p>📊 No betting history</p>
                <small>Your bet history will appear here</small>
            </div>
        `;
        return;
    }
    
    betHistoryList.innerHTML = '';
    
    bets.forEach(bet => {
        const betElement = createBetElement(bet, true);
        betHistoryList.appendChild(betElement);
    });
}

// Create bet element for display
function createBetElement(bet, showResult = false) {
    const betElement = document.createElement('div');
    betElement.className = 'bet-item';
    
    const drawType = DRAW_TYPES[bet.drawType].name;
    const timeAgo = getTimeAgo(bet.timestamp);
    
    let statusClass = 'status-pending';
    let statusText = 'Pending';
    let resultInfo = '';
    
    if (showResult && bet.status !== BET_STATUS.PENDING) {
        if (bet.status === BET_STATUS.WON) {
            statusClass = 'status-win';
            statusText = 'Won';
            resultInfo = `<div style="color: #27ae60; font-weight: bold;">+₹${formatNumber(bet.payout)}</div>`;
        } else if (bet.status === BET_STATUS.LOST) {
            statusClass = 'status-lose';
            statusText = 'Lost';
            resultInfo = `<div style="color: #e74c3c;">Winning: ${bet.winningNumber}</div>`;
        }
    }
    
    betElement.innerHTML = `
        <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <strong style="color: white;">${drawType}</strong>
                <span class="bet-status ${statusClass}">${statusText}</span>
            </div>
            <div style="color: rgba(255,255,255,0.8); font-size: 0.9rem;">
                Number: <strong style="color: var(--gold);">${bet.selectedNumber}</strong> | 
                Bet: ₹${formatNumber(bet.betAmount)} | 
                Multiplier: ${bet.multiplier}x
            </div>
            <div style="color: rgba(255,255,255,0.6); font-size: 0.8rem; margin-top: 0.3rem;">
                ${timeAgo}
            </div>
        </div>
        <div style="text-align: right;">
            <div style="color: var(--gold); font-weight: bold;">₹${formatNumber(bet.totalCost)}</div>
            ${resultInfo}
        </div>
    `;
    
    return betElement;
}

// Filter bet history
function filterBetHistory() {
    const statusFilter = document.getElementById('historyFilter')?.value || 'all';
    const drawFilter = document.getElementById('drawFilter')?.value || 'all';
    
    const filters = {};
    if (statusFilter !== 'all') {
        filters.status = statusFilter === 'won' ? BET_STATUS.WON : 
                         statusFilter === 'lost' ? BET_STATUS.LOST : 
                         BET_STATUS.PENDING;
    }
    if (drawFilter !== 'all') {
        filters.drawType = drawFilter;
    }
    
    const filteredBets = getUserBets({ ...filters, limit: 50 });
    const betHistoryList = document.getElementById('betHistoryList');
    
    if (!betHistoryList) return;
    
    betHistoryList.innerHTML = '';
    
    if (filteredBets.length === 0) {
        betHistoryList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.6);">
                <p>No bets found matching your filters</p>
            </div>
        `;
        return;
    }
    
    filteredBets.forEach(bet => {
        const betElement = createBetElement(bet, true);
        betHistoryList.appendChild(betElement);
    });
}

// Load more bet history
function loadMoreHistory() {
    const betHistoryList = document.getElementById('betHistoryList');
    if (!betHistoryList) return;
    
    const currentBets = betHistoryList.children.length;
    const moreBets = getUserBets({ limit: 20, offset: currentBets });
    
    if (moreBets.length === 0) {
        showNotification('No more betting history to load', 'info');
        return;
    }
    
    moreBets.forEach(bet => {
        const betElement = createBetElement(bet, true);
        betHistoryList.appendChild(betElement);
    });
    
    showNotification(`Loaded ${moreBets.length} more bets`, 'success');
}

// ===== DRAW SIMULATION =====

// Simulate main draw
function simulateMainDraw() {
    const activeBets = getUserBets({ status: BET_STATUS.PENDING, drawType: 'main' });
    
    if (activeBets.length === 0) return;
    
    const winningNumber = generateWinningNumber();
    
    activeBets.forEach(bet => {
        processBetResult(bet, winningNumber);
    });
    
    // Broadcast draw result
    broadcastDrawResult('main', winningNumber);
    
    return winningNumber;
}

// Simulate weekend draw
function simulateWeekendDraw() {
    const activeBets = getUserBets({ status: BET_STATUS.PENDING, drawType: 'weekend' });
    
    if (activeBets.length === 0) return;
    
    const winningNumber = generateWinningNumber();
    
    activeBets.forEach(bet => {
        processBetResult(bet, winningNumber);
    });
    
    // Broadcast draw result
    broadcastDrawResult('weekend', winningNumber);
    
    return winningNumber;
}

// Broadcast draw result (would typically be from server)
function broadcastDrawResult(drawType, winningNumber) {
    showNotification(`🎲 ${DRAW_TYPES[drawType].name} Result: ${winningNumber}`, 'info', 8000);
    
    // Update any visible draw displays
    const scrollContainer = document.getElementById(`${drawType}ScrollContainer`);
    if (scrollContainer) {
        const scrollNumbers = scrollContainer.querySelector('.scroll-numbers');
        if (scrollNumbers) {
            scrollNumbers.classList.add('stopped');
            scrollNumbers.innerHTML = `<div class="winning-number">${winningNumber}</div>`;
        }
    }
    
    // Track global draw event
    trackUserEvent('draw_result', {
        drawType: drawType,
        winningNumber: winningNumber,
        timestamp: new Date().toISOString()
    });
}

// ===== BET RECOMMENDATIONS =====

// Get recommended numbers based on history
function getRecommendedNumbers() {
    const recentDraws = getStoredData('recent_draw_results', []);
    const numberFreq = {};
    
    // Count frequency of each number in recent draws
    recentDraws.forEach(result => {
        numberFreq[result.winningNumber] = (numberFreq[result.winningNumber] || 0) + 1;
    });
    
    // Find least frequent numbers (better odds theoretically)
    const sortedNumbers = Object.keys(numberFreq)
        .sort((a, b) => numberFreq[a] - numberFreq[b])
        .slice(0, 3);
    
    // If no history, return random numbers
    if (sortedNumbers.length === 0) {
        return [getRandomNumber(0, 9), getRandomNumber(0, 9), getRandomNumber(0, 9)];
    }
    
    return sortedNumbers.map(n => parseInt(n));
}

// Get bet suggestion based on user's balance and risk preference
function getBetSuggestion() {
    const balance = getUserBalance();
    const vipLevel = getUserVipLevel();
    const stats = getBettingStats();
    
    let suggestedAmount = 0;
    let suggestedMultiplier = 1;
    let suggestedDraw = 'mini';
    
    // Calculate suggestion based on balance
    if (balance > 10000) {
        suggestedAmount = 500;
        suggestedMultiplier = 2;
        suggestedDraw = 'main';
    } else if (balance > 5000) {
        suggestedAmount = 200;
        suggestedMultiplier = 2;
        suggestedDraw = 'main';
    } else if (balance > 1000) {
        suggestedAmount = 100;
        suggestedMultiplier = 2;
        suggestedDraw = 'mini';
    } else {
        suggestedAmount = 50;
        suggestedMultiplier = 1;
        suggestedDraw = 'mini';
    }
    
    // Adjust based on win rate
    const winRate = parseFloat(stats.winRate) || 0;
    if (winRate < 30) {
        // Low win rate, suggest safer bets
        suggestedMultiplier = Math.max(1, suggestedMultiplier - 1);
        suggestedAmount = Math.floor(suggestedAmount * 0.7);
    } else if (winRate > 70) {
        // High win rate, suggest riskier bets
        suggestedMultiplier = Math.min(5, suggestedMultiplier + 1);
    }
    
    // VIP bonuses
    if (vipLevel >= 3) {
        suggestedAmount = Math.floor(suggestedAmount * 1.2);
    }
    
    return {
        amount: suggestedAmount,
        multiplier: suggestedMultiplier,
        drawType: suggestedDraw,
        recommendedNumbers: getRecommendedNumbers()
    };
}

// ===== TOURNAMENT SYSTEM =====

// Join tournament
function joinTournament(tournamentId, entryFee) {
    if (!isUserLoggedIn()) {
        showNotification('Please login to join tournaments!', 'info');
        return false;
    }
    
    const balance = getUserBalance();
    if (balance < entryFee) {
        showNotification(`Insufficient balance! Need ₹${entryFee} to join tournament.`, 'error');
        return false;
    }
    
    // Deduct entry fee
    if (deductMoneyFromBalance(entryFee, 'tournament_entry', { tournamentId })) {
        // Add user to tournament participants
        let tournaments = getStoredData('user_tournaments', []);
        tournaments.push({
            id: tournamentId,
            entryFee: entryFee,
            joinedAt: new Date().toISOString(),
            status: 'active'
        });
        
        setStoredData('user_tournaments', tournaments);
        
        trackUserEvent('tournament_joined', { tournamentId, entryFee });
        
        return true;
    }
    
    return false;
}

// ===== AUTO-BET SYSTEM =====

// Setup auto-betting
function setupAutoBet(config) {
    if (!isUserLoggedIn()) return false;
    
    const user = getCurrentUser();
    const settings = getUserSettings();
    
    if (!settings.autoPlay) {
        showNotification('Auto-play is disabled in your settings', 'error');
        return false;
    }
    
    // Store auto-bet configuration
    const autoBetConfig = {
        enabled: true,
        drawType: config.drawType || 'mini',
        amount: config.amount || 25,
        multiplier: config.multiplier || 1,
        selectedNumber: config.selectedNumber || getRandomNumber(0, 9),
        stopOnWin: config.stopOnWin || false,
        stopOnLoss: config.stopOnLoss || false,
        maxBets: config.maxBets || 10,
        betCount: 0,
        createdAt: new Date().toISOString()
    };
    
    setStoredData('auto_bet_config_' + user.id, autoBetConfig);
    
    // Start auto-betting
    startAutoBetting();
    
    return true;
}

// Start auto-betting process
function startAutoBetting() {
    const user = getCurrentUser();
    if (!user) return;
    
    const config = getStoredData('auto_bet_config_' + user.id);
    if (!config || !config.enabled) return;
    
    // Check if we should stop
    if (config.betCount >= config.maxBets) {
        stopAutoBetting();
        showNotification('Auto-bet completed: Maximum bets reached', 'info');
        return;
    }
    
    // Check balance
    const drawPrice = DRAW_TYPES[config.drawType].price;
    const totalCost = config.amount + drawPrice;
    
    if (getUserBalance() < totalCost) {
        stopAutoBetting();
        showNotification('Auto-bet stopped: Insufficient balance', 'error');
        return;
    }
    
    // Place auto-bet
    const betData = {
        drawType: config.drawType,
        selectedNumber: config.selectedNumber,
        betAmount: config.amount,
        entryFee: drawPrice,
        multiplier: config.multiplier,
        totalCost: totalCost,
        potentialWin: totalCost * config.multiplier,
        isAutoBet: true
    };
    
    if (processBet(betData)) {
        config.betCount++;
        setStoredData('auto_bet_config_' + user.id, config);
        
        // Schedule next auto-bet
        const interval = config.drawType === 'mini' ? 35000 : 120000; // 35s for mini, 2min for others
        setTimeout(startAutoBetting, interval);
    } else {
        stopAutoBetting();
    }
}

// Stop auto-betting
function stopAutoBetting() {
    const user = getCurrentUser();
    if (!user) return;
    
    const config = getStoredData('auto_bet_config_' + user.id);
    if (config) {
        config.enabled = false;
        setStoredData('auto_bet_config_' + user.id, config);
    }
    
    showNotification('Auto-betting stopped', 'info');
}

// ===== RECORD BET SHORTHAND =====

// Shorthand function for recording bets (used in other files)
function recordBet(drawType, amount) {
    const drawPrice = DRAW_TYPES[drawType]?.price || 25;
    const selectedNumber = getRandomNumber(0, 9);
    
    const betData = {
        drawType: drawType,
        selectedNumber: selectedNumber,
        betAmount: amount,
        entryFee: drawPrice,
        multiplier: 2,
        totalCost: amount + drawPrice,
        potentialWin: (amount + drawPrice) * 2
    };
    
    return processBet(betData);
}

// ===== INITIALIZATION =====

// Initialize betting system
function initializeBettingSystem() {
    // Process any pending mini draws that should be completed
    const pendingMiniBets = getUserBets({ 
        status: BET_STATUS.PENDING, 
        drawType: 'mini' 
    });
    
    pendingMiniBets.forEach(bet => {
        const betAge = Date.now() - new Date(bet.timestamp).getTime();
        if (betAge > 60000) { // More than 1 minute old
            const winningNumber = generateWinningNumber();
            processBetResult(bet, winningNumber);
        }
    });
    
    // Start auto-betting if enabled
    const user = getCurrentUser();
    if (user) {
        const autoBetConfig = getStoredData('auto_bet_config_' + user.id);
        if (autoBetConfig && autoBetConfig.enabled) {
            setTimeout(startAutoBetting, 5000); // Start after 5 seconds
        }
    }
    
    console.log('Betting system initialized');
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (isUserLoggedIn()) {
        initializeBettingSystem();
    }
});

// ===== EXPORT FOR GLOBAL ACCESS =====

// Make functions available globally
window.BettingSystem = {
    processBet,
    recordBet,
    getUserBets,
    getActiveBets,
    getBettingStats,
    loadBettingStats,
    loadActiveBets,
    loadBetHistory,
    filterBetHistory,
    loadMoreHistory,
    simulateMainDraw,
    simulateWeekendDraw,
    getBetSuggestion,
    getRecommendedNumbers,
    joinTournament,
    setupAutoBet,
    startAutoBetting,
    stopAutoBetting
};

console.log('🎯 Golden Lottery Betting System Loaded! 🎯');
