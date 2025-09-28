// ===== MAIN SCRIPT.JS - GOLDEN LOTTERY =====

// Global variables
let currentUser = null;
let notificationTimeout = null;

// ===== UTILITY FUNCTIONS =====

// Initialize clock display
function initializeClock() {
    function updateClock() {
        const now = new Date();
        const options = {
            timeZone: 'Asia/Kolkata',
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        };
        
        const timeString = now.toLocaleString('en-IN', options);
        const clockElement = document.getElementById('clock');
        
        if (clockElement) {
            clockElement.innerHTML = `
                <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">
                    ${now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                </div>
                <div style="font-size: 1rem; opacity: 0.8;">
                    ${now.toLocaleDateString('en-IN', { 
                        timeZone: 'Asia/Kolkata', 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}
                </div>
            `;
        }
    }
    
    updateClock();
    setInterval(updateClock, 1000);
}

// Show notification function
function showNotification(message, type = 'info', duration = 5000) {
    const notification = document.getElementById('notification');
    const notificationContent = document.getElementById('notificationContent');
    
    if (!notification || !notificationContent) return;
    
    // Clear existing timeout
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }
    
    // Remove existing classes
    notification.className = 'notification';
    
    // Set content and type
    notificationContent.textContent = message;
    notification.classList.add(type, 'show');
    
    // Auto hide after duration
    notificationTimeout = setTimeout(() => {
        hideNotification();
    }, duration);
    
    // Hide on click
    notification.onclick = hideNotification;
}

// Hide notification function
function hideNotification() {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.classList.remove('show');
    }
    
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }
}

// Generate random number between min and max
function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Format currency to Indian format
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Format number to Indian format
function formatNumber(num) {
    return new Intl.NumberFormat('en-IN').format(num);
}

// Get time difference in readable format
function getTimeAgo(timestamp) {
    const now = new Date();
    const then = new Date(timestamp);
    const diffInSeconds = Math.floor((now - then) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

// ===== LOCAL STORAGE FUNCTIONS =====

// Get data from localStorage
function getStoredData(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return defaultValue;
    }
}

// Set data to localStorage
function setStoredData(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error('Error writing to localStorage:', error);
        return false;
    }
}

// Remove data from localStorage
function removeStoredData(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('Error removing from localStorage:', error);
        return false;
    }
}

// ===== ANIMATION FUNCTIONS =====

// Add animation class to element
function addAnimation(elementId, animationClass, duration = 1000) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add(animationClass);
        setTimeout(() => {
            element.classList.remove(animationClass);
        }, duration);
    }
}

// Smooth scroll to element
function smoothScrollTo(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
}

// ===== DRAW FUNCTIONS =====

// Generate winning number (0-9)
function generateWinningNumber() {
    return getRandomNumber(0, 9);
}

// Check if number is winning
function checkWinningNumber(selectedNumber, winningNumber) {
    return parseInt(selectedNumber) === parseInt(winningNumber);
}

// Calculate payout based on multiplier and bet amount
function calculatePayout(betAmount, multiplier, isWinner) {
    if (!isWinner) return 0;
    return betAmount * multiplier;
}

// ===== VALIDATION FUNCTIONS =====

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validate phone number (Indian format)
function isValidPhone(phone) {
    const phoneRegex = /^[+]?[91]?[789]\d{9}$/;
    return phoneRegex.test(phone.replace(/\s|-/g, ''));
}

// Validate password strength
function validatePassword(password) {
    if (password.length < 6) return { valid: false, message: 'Password must be at least 6 characters long' };
    if (password.length > 50) return { valid: false, message: 'Password is too long' };
    return { valid: true, message: 'Password is valid' };
}

// ===== DRAW TIMING FUNCTIONS =====

// Get next draw time for a specific draw type
function getNextDrawTime(drawType) {
    const now = new Date();
    let nextDraw = new Date(now);
    
    switch (drawType) {
        case 'main':
            // Main draw every 4 hours (6:00, 10:00, 14:00, 18:00, 22:00, 02:00)
            const mainDrawTimes = [2, 6, 10, 14, 18, 22];
            const currentHour = now.getHours();
            
            let nextMainHour = mainDrawTimes.find(hour => hour > currentHour);
            if (!nextMainHour) {
                nextMainHour = mainDrawTimes[0];
                nextDraw.setDate(nextDraw.getDate() + 1);
            }
            
            nextDraw.setHours(nextMainHour, 0, 0, 0);
            break;
            
        case 'weekend':
            // Weekend special - Saturday and Sunday at 8 PM
            const currentDay = now.getDay();
            if (currentDay === 6 || currentDay === 0) { // Saturday or Sunday
                nextDraw.setHours(20, 0, 0, 0);
                if (now >= nextDraw) {
                    nextDraw.setDate(nextDraw.getDate() + (currentDay === 6 ? 1 : 6));
                }
            } else {
                // Next Saturday
                nextDraw.setDate(nextDraw.getDate() + (6 - currentDay));
                nextDraw.setHours(20, 0, 0, 0);
            }
            break;
            
        case 'mini':
            // Mini draw every 30 minutes
            const currentMinutes = now.getMinutes();
            const nextMinutes = currentMinutes < 30 ? 30 : 0;
            
            nextDraw.setMinutes(nextMinutes, 0, 0);
            if (nextMinutes === 0) {
                nextDraw.setHours(nextDraw.getHours() + 1);
            }
            break;
    }
    
    return nextDraw;
}

// Calculate countdown to next draw
function getCountdownToNextDraw(drawType) {
    const nextDrawTime = getNextDrawTime(drawType);
    const now = new Date();
    const timeDiff = nextDrawTime - now;
    
    if (timeDiff <= 0) return '00:00:00';
    
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ===== SOUND FUNCTIONS =====

// Play sound effect (if audio is enabled)
function playSound(soundType) {
    if (!getStoredData('soundEnabled', true)) return;
    
    // Create audio context for sound effects
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        switch (soundType) {
            case 'win':
                playWinSound(audioContext);
                break;
            case 'lose':
                playLoseSound(audioContext);
                break;
            case 'click':
                playClickSound(audioContext);
                break;
            case 'notification':
                playNotificationSound(audioContext);
                break;
        }
    } catch (error) {
        console.log('Audio not supported or disabled');
    }
}

// Generate win sound
function playWinSound(audioContext) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
    oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// Generate lose sound
function playLoseSound(audioContext) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// Generate click sound
function playClickSound(audioContext) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

// Generate notification sound
function playNotificationSound(audioContext) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

// ===== ERROR HANDLING =====

// Global error handler
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showNotification('An unexpected error occurred. Please refresh the page.', 'error');
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showNotification('A network error occurred. Please check your connection.', 'error');
});

// ===== PERFORMANCE MONITORING =====

// Monitor page load time
window.addEventListener('load', function() {
    const loadTime = performance.now();
    console.log(`Page loaded in ${Math.round(loadTime)}ms`);
    
    if (loadTime > 3000) {
        console.warn('Slow page load detected');
    }
});

// ===== INITIALIZATION =====

// Initialize common features when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize clock if element exists
    if (document.getElementById('clock')) {
        initializeClock();
    }
    
    // Add click sound to all buttons
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', () => playSound('click'));
    });
    
    // Add loading states to forms
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn && !submitBtn.disabled) {
                const originalText = submitBtn.textContent;
                submitBtn.textContent = '🔄 Processing...';
                submitBtn.disabled = true;
                
                // Re-enable after 5 seconds (fallback)
                setTimeout(() => {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }, 5000);
            }
        });
    });
    
    // Add smooth scrolling to anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        });
    });
    
    // Add input validation feedback
    document.querySelectorAll('input[type="email"]').forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value && !isValidEmail(this.value)) {
                this.style.borderColor = '#e74c3c';
                showNotification('Please enter a valid email address', 'error', 3000);
            } else {
                this.style.borderColor = '';
            }
        });
    });
    
    document.querySelectorAll('input[type="tel"]').forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value && !isValidPhone(this.value)) {
                this.style.borderColor = '#e74c3c';
                showNotification('Please enter a valid phone number', 'error', 3000);
            } else {
                this.style.borderColor = '';
            }
        });
    });
    
    // Update authentication link
    updateAuthLink();
    
    console.log('Golden Lottery initialized successfully! 🎰');
});

// Update authentication link based on login status
function updateAuthLink() {
    const authLink = document.getElementById('authLink');
    if (authLink) {
        if (isUserLoggedIn()) {
            authLink.textContent = 'Logout';
            authLink.href = '#';
            authLink.onclick = function(e) {
                e.preventDefault();
                logoutUser();
                window.location.href = 'index.html';
            };
        } else {
            authLink.textContent = 'Login';
            authLink.href = 'login.html';
            authLink.onclick = null;
        }
    }
}

// ===== EXPORT FOR USE IN OTHER FILES =====

// Make functions available globally
window.GoldenLottery = {
    showNotification,
    hideNotification,
    getRandomNumber,
    formatCurrency,
    formatNumber,
    getTimeAgo,
    getStoredData,
    setStoredData,
    removeStoredData,
    generateWinningNumber,
    checkWinningNumber,
    calculatePayout,
    isValidEmail,
    isValidPhone,
    validatePassword,
    getNextDrawTime,
    getCountdownToNextDraw,
    playSound,
    addAnimation,
    smoothScrollTo
};

console.log('🎰 Golden Lottery Core System Loaded! 🎰');
