// ===== USER.JS - USER MANAGEMENT SYSTEM =====

// User management constants
const USER_STORAGE_KEY = 'goldenLottery_currentUser';
const USER_SETTINGS_KEY = 'goldenLottery_userSettings';
const USER_SESSION_KEY = 'goldenLottery_userSession';

// Default user settings
const DEFAULT_SETTINGS = {
    soundEnabled: true,
    notificationsEnabled: true,
    theme: 'dark',
    language: 'en',
    currency: 'INR',
    autoPlay: false,
    quickBetAmounts: [50, 100, 500, 1000],
    favoriteNumbers: [],
    privacyMode: false
};

// ===== USER AUTHENTICATION =====

// Check if user is logged in
function isUserLoggedIn() {
    const user = getCurrentUser();
    const session = getStoredData(USER_SESSION_KEY);
    
    if (!user || !session) return false;
    
    // Check if session is expired
    const now = new Date();
    const sessionExpiry = new Date(session.expiresAt);
    
    if (now > sessionExpiry) {
        logoutUser();
        return false;
    }
    
    return true;
}

// Get current logged in user
function getCurrentUser() {
    return getStoredData(USER_STORAGE_KEY);
}

// Login user with data
function loginUser(userData, rememberMe = false) {
    try {
        // Set user data
        setStoredData(USER_STORAGE_KEY, userData);
        
        // Create session
        const sessionDuration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 30 days or 1 day
        const session = {
            userId: userData.id,
            loginTime: new Date().toISOString(),
            expiresAt: new Date(Date.now() + sessionDuration).toISOString(),
            rememberMe: rememberMe,
            loginMethod: userData.loginMethod || 'email'
        };
        
        setStoredData(USER_SESSION_KEY, session);
        
        // Initialize user settings if not exist
        if (!getStoredData(USER_SETTINGS_KEY + '_' + userData.id)) {
            setStoredData(USER_SETTINGS_KEY + '_' + userData.id, DEFAULT_SETTINGS);
        }
        
        // Update last login
        userData.lastLogin = new Date().toISOString();
        setStoredData(USER_STORAGE_KEY, userData);
        
        // Track login analytics
        trackUserEvent('login', {
            method: userData.loginMethod || 'email',
            rememberMe: rememberMe,
            vipLevel: userData.vipLevel || 1
        });
        
        console.log('User logged in successfully:', userData.name);
        return true;
        
    } catch (error) {
        console.error('Error logging in user:', error);
        showNotification('Login failed. Please try again.', 'error');
        return false;
    }
}

// Logout user
function logoutUser() {
    try {
        const currentUser = getCurrentUser();
        
        if (currentUser) {
            // Track logout analytics
            trackUserEvent('logout', {
                sessionDuration: getSessionDuration(),
                vipLevel: currentUser.vipLevel || 1
            });
        }
        
        // Clear user data
        removeStoredData(USER_STORAGE_KEY);
        removeStoredData(USER_SESSION_KEY);
        
        // Clear current user reference
        currentUser = null;
        
        console.log('User logged out successfully');
        showNotification('Logged out successfully!', 'success');
        
        return true;
        
    } catch (error) {
        console.error('Error logging out user:', error);
        return false;
    }
}

// ===== USER PROFILE MANAGEMENT =====

// Update user profile
function updateUserProfile(updates) {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            showNotification('Please login to update profile!', 'error');
            return false;
        }
        
        // Merge updates with current user data
        const updatedUser = { ...currentUser, ...updates };
        updatedUser.lastUpdated = new Date().toISOString();
        
        // Save updated user data
        setStoredData(USER_STORAGE_KEY, updatedUser);
        
        // Track profile update
        trackUserEvent('profile_update', {
            fieldsUpdated: Object.keys(updates),
            vipLevel: updatedUser.vipLevel
        });
        
        console.log('User profile updated:', updates);
        return true;
        
    } catch (error) {
        console.error('Error updating user profile:', error);
        showNotification('Failed to update profile. Please try again.', 'error');
        return false;
    }
}

// ===== BALANCE MANAGEMENT =====

// Get user balance
function getUserBalance() {
    const user = getCurrentUser();
    return user ? user.balance || 0 : 0;
}

// Update user balance
function updateUserBalance(newBalance) {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) return false;
        
        const oldBalance = currentUser.balance || 0;
        const difference = newBalance - oldBalance;
        
        // Update balance
        currentUser.balance = Math.max(0, newBalance); // Ensure balance doesn't go negative
        currentUser.lastBalanceUpdate = new Date().toISOString();
        
        // Save updated user
        setStoredData(USER_STORAGE_KEY, currentUser);
        
        // Track balance change
        trackUserEvent('balance_update', {
            oldBalance: oldBalance,
            newBalance: newBalance,
            difference: difference,
            vipLevel: currentUser.vipLevel
        });
        
        // Show balance animation if difference is significant
        if (Math.abs(difference) > 0) {
            addAnimation('userBalance', 'balance-animation');
            
            if (difference > 0) {
                playSound('win');
            }
        }
        
        return true;
        
    } catch (error) {
        console.error('Error updating user balance:', error);
        return false;
    }
}

// Add money to user balance
function addMoneyToBalance(amount, source = 'manual', metadata = {}) {
    const currentBalance = getUserBalance();
    const newBalance = currentBalance + amount;
    
    if (updateUserBalance(newBalance)) {
        // Record transaction
        addTransaction({
            type: 'credit',
            amount: amount,
            source: source,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            metadata: metadata,
            timestamp: new Date().toISOString()
        });
        
        showNotification(`₹${formatNumber(amount)} added to your account!`, 'success');
        return true;
    }
    
    return false;
}

// Deduct money from user balance
function deductMoneyFromBalance(amount, reason = 'bet', metadata = {}) {
    const currentBalance = getUserBalance();
    
    if (currentBalance < amount) {
        showNotification('Insufficient balance!', 'error');
        return false;
    }
    
    const newBalance = currentBalance - amount;
    
    if (updateUserBalance(newBalance)) {
        // Record transaction
        addTransaction({
            type: 'debit',
            amount: amount,
            reason: reason,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            metadata: metadata,
            timestamp: new Date().toISOString()
        });
        
        return true;
    }
    
    return false;
}

// ===== VIP SYSTEM =====

// Get user VIP level
function getUserVipLevel() {
    const user = getCurrentUser();
    return user ? user.vipLevel || 1 : 1;
}

// Update user VIP level
function updateUserVipLevel(newLevel) {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) return false;
        
        const oldLevel = currentUser.vipLevel || 1;
        
        if (newLevel > oldLevel) {
            currentUser.vipLevel = newLevel;
            currentUser.vipUpgradeDate = new Date().toISOString();
            
            setStoredData(USER_STORAGE_KEY, currentUser);
            
            // Show VIP upgrade notification
            showNotification(`🎉 Congratulations! You've been upgraded to VIP ${newLevel}!`, 'success');
            
            // Give VIP upgrade bonus
            const bonusAmount = newLevel * 100;
            addMoneyToBalance(bonusAmount, 'vip_bonus', { vipLevel: newLevel });
            
            // Track VIP upgrade
            trackUserEvent('vip_upgrade', {
                oldLevel: oldLevel,
                newLevel: newLevel,
                bonusAmount: bonusAmount
            });
            
            playSound('win');
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('Error updating VIP level:', error);
        return false;
    }
}

// Check if user qualifies for VIP upgrade
function checkVipUpgrade() {
    const user = getCurrentUser();
    if (!user) return false;
    
    const currentLevel = user.vipLevel || 1;
    const totalSpent = getUserTotalSpent();
    const accountAge = getAccountAgeDays();
    
    let qualifiedLevel = 1;
    
    // VIP qualification criteria
    if (totalSpent >= 50000 && accountAge >= 30) qualifiedLevel = 5;
    else if (totalSpent >= 25000 && accountAge >= 20) qualifiedLevel = 4;
    else if (totalSpent >= 10000 && accountAge >= 15) qualifiedLevel = 3;
    else if (totalSpent >= 5000 && accountAge >= 7) qualifiedLevel = 2;
    
    if (qualifiedLevel > currentLevel) {
        updateUserVipLevel(qualifiedLevel);
        return true;
    }
    
    return false;
}

// Get VIP benefits for level
function getVipBenefits(level = null) {
    if (!level) level = getUserVipLevel();
    
    const benefits = {
        1: { dailyBonus: 25, withdrawLimit: 10000, betBonus: 0 },
        2: { dailyBonus: 50, withdrawLimit: 25000, betBonus: 5 },
        3: { dailyBonus: 100, withdrawLimit: 50000, betBonus: 10 },
        4: { dailyBonus: 200, withdrawLimit: 100000, betBonus: 15 },
        5: { dailyBonus: 500, withdrawLimit: 500000, betBonus: 25 }
    };
    
    return benefits[level] || benefits[1];
}

// ===== USER SETTINGS =====

// Get user settings
function getUserSettings() {
    const user = getCurrentUser();
    if (!user) return DEFAULT_SETTINGS;
    
    const settings = getStoredData(USER_SETTINGS_KEY + '_' + user.id);
    return { ...DEFAULT_SETTINGS, ...settings };
}

// Update user settings
function updateUserSettings(newSettings) {
    try {
        const user = getCurrentUser();
        if (!user) return false;
        
        const currentSettings = getUserSettings();
        const updatedSettings = { ...currentSettings, ...newSettings };
        
        setStoredData(USER_SETTINGS_KEY + '_' + user.id, updatedSettings);
        
        // Apply settings immediately
        applyUserSettings(updatedSettings);
        
        trackUserEvent('settings_update', { settingsChanged: Object.keys(newSettings) });
        
        return true;
        
    } catch (error) {
        console.error('Error updating user settings:', error);
        return false;
    }
}

// Apply user settings to the UI
function applyUserSettings(settings = null) {
    if (!settings) settings = getUserSettings();
    
    // Apply theme
    document.body.setAttribute('data-theme', settings.theme);
    
    // Apply sound settings
    if (!settings.soundEnabled) {
        // Disable all sounds
        window.playSound = () => {};
    }
    
    // Apply other settings as needed
    console.log('User settings applied:', settings);
}

// ===== TRANSACTION MANAGEMENT =====

// Add transaction record
function addTransaction(transactionData) {
    try {
        const user = getCurrentUser();
        if (!user) return false;
        
        const transaction = {
            id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            userId: user.id,
            ...transactionData,
            timestamp: transactionData.timestamp || new Date().toISOString()
        };
        
        // Get existing transactions
        const transactions = getStoredData('transactions_' + user.id, []);
        
        // Add new transaction at the beginning
        transactions.unshift(transaction);
        
        // Keep only last 1000 transactions to prevent storage overflow
        if (transactions.length > 1000) {
            transactions.splice(1000);
        }
        
        // Save transactions
        setStoredData('transactions_' + user.id, transactions);
        
        return true;
        
    } catch (error) {
        console.error('Error adding transaction:', error);
        return false;
    }
}

// Get user transactions
function getUserTransactions(limit = 50, filter = {}) {
    const user = getCurrentUser();
    if (!user) return [];
    
    let transactions = getStoredData('transactions_' + user.id, []);
    
    // Apply filters
    if (filter.type) {
        transactions = transactions.filter(txn => txn.type === filter.type);
    }
    
    if (filter.dateFrom) {
        const dateFrom = new Date(filter.dateFrom);
        transactions = transactions.filter(txn => new Date(txn.timestamp) >= dateFrom);
    }
    
    if (filter.dateTo) {
        const dateTo = new Date(filter.dateTo);
        transactions = transactions.filter(txn => new Date(txn.timestamp) <= dateTo);
    }
    
    // Return limited results
    return transactions.slice(0, limit);
}

// Get balance statistics
function getBalanceStatistics() {
    const transactions = getUserTransactions(1000);
    
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalWinnings = 0;
    let totalBets = 0;
    
    transactions.forEach(txn => {
        switch (txn.type) {
            case 'credit':
                if (txn.source === 'deposit') totalDeposits += txn.amount;
                else if (txn.source === 'win') totalWinnings += txn.amount;
                break;
            case 'debit':
                if (txn.reason === 'withdrawal') totalWithdrawals += txn.amount;
                else if (txn.reason === 'bet') totalBets += txn.amount;
                break;
        }
    });
    
    const netProfit = totalWinnings - totalBets;
    
    return {
        totalDeposits,
        totalWithdrawals,
        totalWinnings,
        totalBets,
        netProfit,
        transactionCount: transactions.length
    };
}

// ===== USER ANALYTICS =====

// Track user events
function trackUserEvent(eventName, eventData = {}) {
    try {
        const user = getCurrentUser();
        const event = {
            event: eventName,
            userId: user ? user.id : 'anonymous',
            timestamp: new Date().toISOString(),
            data: eventData,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        // Store events locally (in a real app, this would be sent to analytics server)
        const events = getStoredData('user_events', []);
        events.push(event);
        
        // Keep only last 500 events
        if (events.length > 500) {
            events.splice(0, events.length - 500);
        }
        
        setStoredData('user_events', events);
        
        console.log('Event tracked:', eventName, eventData);
        
    } catch (error) {
        console.error('Error tracking event:', error);
    }
}

// Get user total spent
function getUserTotalSpent() {
    const stats = getBalanceStatistics();
    return stats.totalBets;
}

// Get account age in days
function getAccountAgeDays() {
    const user = getCurrentUser();
    if (!user || !user.joinDate) return 0;
    
    const joinDate = new Date(user.joinDate);
    const now = new Date();
    const diffTime = Math.abs(now - joinDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

// Get session duration in minutes
function getSessionDuration() {
    const session = getStoredData(USER_SESSION_KEY);
    if (!session) return 0;
    
    const loginTime = new Date(session.loginTime);
    const now = new Date();
    const diffMinutes = Math.floor((now - loginTime) / (1000 * 60));
    
    return diffMinutes;
}

// ===== USER DATA LOADING =====

// Load and display user data on page
function loadUserData() {
    if (!isUserLoggedIn()) return false;
    
    const user = getCurrentUser();
    if (!user) return false;
    
    try {
        // Update user info elements
        const elements = {
            userName: user.name,
            userBalance: formatNumber(user.balance || 0),
            vipBadge: `VIP ${user.vipLevel || 1}`,
            userRank: Math.floor(Math.random() * 1000) + 1, // Simulated rank
            userPoints: Math.floor((user.balance || 0) * 0.1)
        };
        
        Object.keys(elements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = elements[id];
            }
        });
        
        // Update VIP badge class
        const vipBadgeElement = document.getElementById('vipBadge');
        if (vipBadgeElement) {
            vipBadgeElement.className = `vip-badge vip${user.vipLevel || 1}`;
        }
        
        // Show user info sections
        const userInfoElements = document.querySelectorAll('#userInfo, #userQuickInfo, #userRankInfo');
        userInfoElements.forEach(element => {
            if (element) element.style.display = 'flex';
        });
        
        // Update profile image if exists
        const profileImage = document.getElementById('profileImage');
        if (profileImage && user.profileImage) {
            profileImage.src = user.profileImage;
        }
        
        // Check for VIP upgrades
        checkVipUpgrade();
        
        return true;
        
    } catch (error) {
        console.error('Error loading user data:', error);
        return false;
    }
}

// ===== BONUS SYSTEM =====

// Check daily login bonus
function checkDailyBonus() {
    const user = getCurrentUser();
    if (!user) return false;
    
    const today = new Date().toDateString();
    const lastBonus = user.lastDailyBonus;
    
    if (lastBonus !== today) {
        const vipBenefits = getVipBenefits();
        const bonusAmount = vipBenefits.dailyBonus;
        
        // Give daily bonus
        addMoneyToBalance(bonusAmount, 'daily_bonus');
        
        // Update last bonus date
        user.lastDailyBonus = today;
        user.loginStreak = (user.loginStreak || 0) + 1;
        
        setStoredData(USER_STORAGE_KEY, user);
        
        showNotification(`🎁 Daily bonus: ₹${bonusAmount}! Streak: ${user.loginStreak} days`, 'success');
        
        return true;
    }
    
    return false;
}

// Apply referral bonus
function applyReferralBonus(referralCode) {
    const user = getCurrentUser();
    if (!user || user.referralApplied) return false;
    
    // Validate referral code (in real app, this would check against database)
    if (referralCode && referralCode.length >= 6) {
        const bonusAmount = 500;
        addMoneyToBalance(bonusAmount, 'referral_bonus', { referralCode });
        
        user.referralApplied = true;
        user.referredBy = referralCode;
        setStoredData(USER_STORAGE_KEY, user);
        
        trackUserEvent('referral_bonus', { referralCode, bonusAmount });
        
        return true;
    }
    
    return false;
}

// ===== INITIALIZATION =====

// Initialize user system
function initializeUserSystem() {
    // Apply user settings if logged in
    if (isUserLoggedIn()) {
        applyUserSettings();
        loadUserData();
        checkDailyBonus();
    }
    
    // Update auth link
    updateAuthLink();
    
    console.log('User system initialized');
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeUserSystem();
});

// ===== EXPORT FOR GLOBAL ACCESS =====

// Make functions available globally
window.UserSystem = {
    isUserLoggedIn,
    getCurrentUser,
    loginUser,
    logoutUser,
    updateUserProfile,
    getUserBalance,
    updateUserBalance,
    addMoneyToBalance,
    deductMoneyFromBalance,
    getUserVipLevel,
    updateUserVipLevel,
    checkVipUpgrade,
    getVipBenefits,
    getUserSettings,
    updateUserSettings,
    addTransaction,
    getUserTransactions,
    getBalanceStatistics,
    trackUserEvent,
    loadUserData,
    checkDailyBonus,
    applyReferralBonus
};

console.log('👤 Golden Lottery User System Loaded! 👤');
