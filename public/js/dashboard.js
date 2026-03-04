// ==========================================
// DASHBOARD JAVASCRIPT
// ==========================================

let currentUser = null;
let dashboardData = null;

// ==========================================
// INITIALIZE DASHBOARD
// ==========================================

document.addEventListener('DOMContentLoaded', function () {
    // Require authentication
    currentUser = requireAuth();
    if (!currentUser) return;

    // Load branding
    loadBranding();

    // Display user name if element exists
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = currentUser.fullName;
    }

    // Show admin panel link if user is admin
    if (currentUser.role === 'admin') {
        const adminNavLink = document.getElementById('adminNavLink');
        if (adminNavLink) {
            adminNavLink.innerHTML = '<a href="/admin.html" class="nav-link"><i class="fas fa-cog"></i><span>Admin Panel</span></a>';
        }
    }

    // Load dashboard data
    loadDashboardData();

    // Setup event listeners
    setupEventListeners();
});

// ==========================================
// LOAD DASHBOARD DATA
// ==========================================

async function loadDashboardData() {
    try {
        const response = await fetch(`/api/dashboard/${currentUser.id}`);
        const data = await response.json();

        dashboardData = data;

        // Update UI
        updateStats(data.summary);
        updateBudgetProgress(data.summary);
        renderAlerts(data.summary.overspending);
        renderCategoryChart(data.categoryTotals);
        renderTrendChart(data.monthlyTrends);
        renderSuggestions(data.suggestions);
        renderRecentTransactions(data.recentExpenses);

    } catch (error) {
        console.error('Error loading dashboard:', error);
        alert('Error loading dashboard data');
    }
}

// ==========================================
// UPDATE STATS CARDS
// ==========================================

function updateStats(summary) {
    // Animate number counting
    animateNumber('totalSpent', 0, parseFloat(summary.totalSpent), '₹');
    animateNumber('totalSavings', 0, parseFloat(summary.savings), '₹');
    animateNumber('totalBudget', 0, parseFloat(summary.budget), '₹');
    animateNumber('expenseCount', 0, summary.expenseCount, '');
}

function animateNumber(elementId, start, end, prefix = '') {
    const element = document.getElementById(elementId);
    const duration = 1000;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const current = start + (end - start) * progress;
        element.textContent = prefix + current.toFixed(2);

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// ==========================================
// UPDATE BUDGET PROGRESS
// ==========================================

function updateBudgetProgress(summary) {
    const spent = parseFloat(summary.totalSpent);
    const budget = parseFloat(summary.budget);
    const percentage = Math.min((spent / budget) * 100, 100);

    const progressBar = document.getElementById('budgetProgressBar');

    // Set color based on percentage
    let gradient = 'var(--success-gradient)';
    if (percentage > 90) {
        gradient = 'var(--danger-gradient)';
    } else if (percentage > 75) {
        gradient = 'var(--warning-gradient)';
    }

    progressBar.style.background = gradient;

    // Animate width
    setTimeout(() => {
        progressBar.style.width = percentage + '%';
    }, 100);

    document.getElementById('budgetSpentLabel').textContent = `Spent: ₹${spent.toFixed(2)}`;
    document.getElementById('budgetRemainingLabel').textContent = `Remaining: ₹${(budget - spent).toFixed(2)}`;
}

// ==========================================
// RENDER ALERTS
// ==========================================

function renderAlerts(overspending) {
    const container = document.getElementById('alertsContainer');
    container.innerHTML = '';

    if (overspending.isOverspending) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger animate-fade-in-up';
        alert.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <div>
                <strong>Overspending Alert!</strong> You've exceeded your budget by ₹${Math.abs(overspending.amount)}.
                Consider reviewing your expenses and cutting back on non-essential spending.
            </div>
        `;
        container.appendChild(alert);
    } else if (overspending.percentage > 90) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-warning animate-fade-in-up';
        alert.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <div>
                <strong>Budget Warning!</strong> You've used ${overspending.percentage}% of your budget.
                Be mindful of your spending for the rest of the month.
            </div>
        `;
        container.appendChild(alert);
    }
}

// ==========================================
// RENDER CHARTS
// ==========================================

function renderCategoryChart(categoryTotals) {
    const categoryColors = {
        'Food': '#ff6b6b',
        'Travel': '#4facfe',
        'Shopping': '#f093fb',
        'Bills': '#764ba2',
        'Entertainment': '#fee140',
        'Health': '#00f2fe',
        'Education': '#667eea',
        'Other': '#a0aec0'
    };

    const columns = Object.entries(categoryTotals).map(([category, amount]) => [category, amount]);

    if (columns.length === 0) {
        document.getElementById('categoryChart').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No expenses yet</p>';
        return;
    }

    c3.generate({
        bindto: '#categoryChart',
        data: {
            columns: columns,
            type: 'donut',
            colors: categoryColors
        },
        donut: {
            title: 'Expenses',
            label: {
                format: function (value, ratio, id) {
                    return '₹' + value.toFixed(0);
                }
            }
        },
        legend: {
            position: 'bottom'
        }
    });
}

function renderTrendChart(monthlyTrends) {
    const months = Object.keys(monthlyTrends).sort().reverse().slice(0, 6).reverse();
    const amounts = months.map(month => monthlyTrends[month]);

    if (months.length === 0) {
        document.getElementById('trendChart').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No data yet</p>';
        return;
    }

    const data = ['Spending', ...amounts];
    const categories = months.map(m => {
        const date = new Date(m + '-01');
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    c3.generate({
        bindto: '#trendChart',
        data: {
            columns: [data],
            type: 'area-spline',
            colors: {
                'Spending': '#667eea'
            }
        },
        axis: {
            x: {
                type: 'category',
                categories: categories
            },
            y: {
                tick: {
                    format: function (d) {
                        return '₹' + d.toFixed(0);
                    }
                }
            }
        },
        grid: {
            y: {
                show: true
            }
        },
        point: {
            r: 4
        }
    });
}

// ==========================================
// RENDER SUGGESTIONS
// ==========================================

function renderSuggestions(suggestions) {
    const container = document.getElementById('suggestionsContainer');
    container.innerHTML = '';

    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No suggestions available</p>';
        return;
    }

    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = `suggestion-item ${suggestion.type}`;
        item.innerHTML = `
            <i class="${suggestion.icon} suggestion-icon"></i>
            <p class="suggestion-text">${suggestion.message}</p>
        `;
        container.appendChild(item);
    });
}

// ==========================================
// RENDER RECENT TRANSACTIONS
// ==========================================

function renderRecentTransactions(transactions) {
    const container = document.getElementById('recentTransactions');
    container.innerHTML = '';

    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No transactions yet</p>';
        return;
    }

    const categoryIcons = {
        'Food': 'fa-utensils',
        'Travel': 'fa-car',
        'Shopping': 'fa-shopping-bag',
        'Bills': 'fa-file-invoice',
        'Entertainment': 'fa-film',
        'Health': 'fa-heartbeat',
        'Education': 'fa-graduation-cap',
        'Other': 'fa-tag'
    };

    transactions.forEach(transaction => {
        const item = document.createElement('div');
        item.className = 'transaction-item';

        const date = new Date(transaction.date);
        const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        item.innerHTML = `
            <div class="transaction-left">
                <div class="transaction-icon category-${transaction.category.toLowerCase()}">
                    <i class="fas ${categoryIcons[transaction.category] || 'fa-tag'}"></i>
                </div>
                <div class="transaction-details">
                    <h4>${transaction.category}</h4>
                    <p>${formattedDate} • ${transaction.paymentMode}</p>
                </div>
            </div>
            <div class="transaction-amount">-₹${parseFloat(transaction.amount).toFixed(2)}</div>
        `;

        container.appendChild(item);
    });
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function (e) {
        e.preventDefault();
        logout();
    });

    // Download Summary Button
    const downloadBtn = document.getElementById('downloadSummaryBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadSummaryReport);
    }

    // Sidebar toggle for mobile
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const navLinks = document.querySelectorAll('.nav-link');

    // Function to close sidebar
    function closeSidebar() {
        sidebar.classList.remove('active');
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
        }
    }

    // Function to open sidebar
    function openSidebar() {
        sidebar.classList.add('active');
        if (sidebarOverlay) {
            sidebarOverlay.classList.add('active');
        }
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function () {
            sidebar.classList.toggle('active');
            if (sidebarOverlay) {
                sidebarOverlay.classList.toggle('active');
            }
        });
    }

    // Close sidebar when clicking overlay
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // Close sidebar when clicking nav links
    navLinks.forEach(link => {
        link.addEventListener('click', function () {
            // Only close sidebar on mobile (when it's not already hidden by CSS)
            const isSmallScreen = window.innerWidth <= 1024;
            if (isSmallScreen) {
                closeSidebar();
            }
        });
    });

    // Theme Toggle (Dark/Light mode)
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        // Initialize theme - default to dark theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.documentElement.removeAttribute('data-theme');
            themeToggle.querySelector('i').classList.replace('fa-sun', 'fa-moon');
        } else {
            // Default to dark theme if no preference saved
            document.documentElement.setAttribute('data-theme', 'dark');
            themeToggle.querySelector('i').classList.replace('fa-moon', 'fa-sun');
        }

        themeToggle.addEventListener('click', function () {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            let newTheme = 'light';

            if (currentTheme === 'dark') {
                document.documentElement.removeAttribute('data-theme');
                this.querySelector('i').classList.replace('fa-sun', 'fa-moon');
            } else {
                newTheme = 'dark';
                document.documentElement.setAttribute('data-theme', 'dark');
                this.querySelector('i').classList.replace('fa-moon', 'fa-sun');
            }

            localStorage.setItem('theme', newTheme);

            // Re-render C3 charts to adapt to color changes if they exist
            if (dashboardData && window.c3) {
                renderCategoryChart(dashboardData.categoryTotals);
                renderTrendChart(dashboardData.monthlyTrends);
            }
        });
    }
}

// ==========================================
// DOWNLOAD SUMMARY REPORT
// ==========================================

async function downloadSummaryReport() {
    if (!dashboardData) {
        alert('No data available to download');
        return;
    }

    try {
        const btn = document.getElementById('downloadSummaryBtn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF...';
        btn.disabled = true;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const summary = dashboardData.summary;
        const date = new Date().toLocaleString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        let yPosition = 20;
        const leftMargin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Title
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('EXPENSE TRACKER', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 8;
        doc.setFontSize(16);
        doc.text('Summary Report', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;

        // Header info
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`User: ${currentUser.fullName}`, leftMargin, yPosition);
        yPosition += 6;
        doc.text(`Generated: ${date}`, leftMargin, yPosition);
        yPosition += 10;

        // Draw line
        doc.setLineWidth(0.5);
        doc.line(leftMargin, yPosition, pageWidth - leftMargin, yPosition);
        yPosition += 10;

        // Financial Overview Section
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('FINANCIAL OVERVIEW', leftMargin, yPosition);
        yPosition += 8;

        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');

        // Fixed: API returns totalSpent, not totalExpenses or totalExpent
        const totalSpent = parseFloat(summary.totalSpent || 0);
        const budget = parseFloat(summary.budget || 0);
        const savings = parseFloat(summary.savings || 0);
        const budgetUsed = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;
        const budgetRemaining = budget - totalSpent;

        // Use Rs. instead of ₹ to avoid encoding issues
        doc.text(`Total Spent:`, leftMargin, yPosition);
        doc.setFont(undefined, 'bold');
        doc.text(`Rs. ${totalSpent.toFixed(2)}`, pageWidth - leftMargin - 40, yPosition);
        yPosition += 7;

        doc.setFont(undefined, 'normal');
        doc.text(`Monthly Budget:`, leftMargin, yPosition);
        doc.setFont(undefined, 'bold');
        doc.text(`Rs. ${budget.toFixed(2)}`, pageWidth - leftMargin - 40, yPosition);
        yPosition += 7;

        doc.setFont(undefined, 'normal');
        doc.text(`Savings:`, leftMargin, yPosition);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(46, 134, 89); // Green color
        doc.text(`Rs. ${savings.toFixed(2)}`, pageWidth - leftMargin - 40, yPosition);
        doc.setTextColor(0, 0, 0); // Reset to black
        yPosition += 7;

        doc.setFont(undefined, 'normal');
        doc.text(`Total Transactions:`, leftMargin, yPosition);
        doc.setFont(undefined, 'bold');
        doc.text(`${summary.expenseCount}`, pageWidth - leftMargin - 40, yPosition);
        yPosition += 12;

        // Budget Status Section
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('BUDGET STATUS', leftMargin, yPosition);
        yPosition += 8;

        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text(`Budget Used:`, leftMargin, yPosition);

        // Color code budget usage
        if (budgetUsed > 100) {
            doc.setTextColor(220, 53, 69); // Red
        } else if (budgetUsed > 75) {
            doc.setTextColor(255, 193, 7); // Yellow/Warning
        } else {
            doc.setTextColor(46, 134, 89); // Green
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${budgetUsed}%`, pageWidth - leftMargin - 40, yPosition);
        doc.setTextColor(0, 0, 0);
        yPosition += 7;

        doc.setFont(undefined, 'normal');
        doc.text(`Budget Remaining:`, leftMargin, yPosition);
        doc.setFont(undefined, 'bold');
        if (budgetRemaining < 0) {
            doc.setTextColor(220, 53, 69);
        }
        doc.text(`Rs. ${budgetRemaining.toFixed(2)}`, pageWidth - leftMargin - 40, yPosition);
        doc.setTextColor(0, 0, 0);
        yPosition += 7;

        doc.setFont(undefined, 'normal');
        doc.text(`Status:`, leftMargin, yPosition);
        doc.setFont(undefined, 'bold');
        if (summary.overspending && summary.overspending.isOverspending) {
            doc.setTextColor(220, 53, 69);
            doc.text('OVERSPENDING', pageWidth - leftMargin - 40, yPosition);
        } else {
            doc.setTextColor(46, 134, 89);
            doc.text('Within Budget', pageWidth - leftMargin - 40, yPosition);
        }
        doc.setTextColor(0, 0, 0);
        yPosition += 12;

        // Category Breakdown Section
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('SPENDING BY CATEGORY', leftMargin, yPosition);
        yPosition += 8;

        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');

        const categories = Object.entries(dashboardData.categoryTotals || {});
        if (categories.length > 0) {
            categories.forEach(([category, amount]) => {
                const percentage = totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0;
                doc.text(`${category}:`, leftMargin, yPosition);
                doc.text(`Rs. ${amount.toFixed(2)} (${percentage}%)`, pageWidth - leftMargin - 50, yPosition);
                yPosition += 6;
            });
        } else {
            doc.text('No expenses recorded yet', leftMargin, yPosition);
            yPosition += 6;
        }

        yPosition += 15;

        // Capture and add charts
        const categoryChartEl = document.getElementById('categoryChart');
        const trendChartEl = document.getElementById('trendChart');

        if (categoryChartEl && categoryChartEl.querySelector('svg')) {
            // Add new page for charts
            doc.addPage();
            yPosition = 20;

            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('VISUAL ANALYTICS', leftMargin, yPosition);
            yPosition += 10;

            // Capture category chart
            const categoryCanvas = await html2canvas(categoryChartEl, {
                backgroundColor: '#ffffff',
                scale: 2
            });
            const categoryImgData = categoryCanvas.toDataURL('image/png');
            const imgWidth = pageWidth - (2 * leftMargin);
            const imgHeight = (categoryCanvas.height * imgWidth) / categoryCanvas.width;

            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('Spending by Category', leftMargin, yPosition);
            yPosition += 5;

            doc.addImage(categoryImgData, 'PNG', leftMargin, yPosition, imgWidth, Math.min(imgHeight, 80));
            yPosition += Math.min(imgHeight, 80) + 15;

            // Capture trend chart if it fits
            if (trendChartEl && trendChartEl.querySelector('svg') && yPosition + 80 < pageHeight - 20) {
                const trendCanvas = await html2canvas(trendChartEl, {
                    backgroundColor: '#ffffff',
                    scale: 2
                });
                const trendImgData = trendCanvas.toDataURL('image/png');
                const trendImgHeight = (trendCanvas.height * imgWidth) / trendCanvas.width;

                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('Monthly Trends', leftMargin, yPosition);
                yPosition += 5;

                doc.addImage(trendImgData, 'PNG', leftMargin, yPosition, imgWidth, Math.min(trendImgHeight, 80));
            } else if (trendChartEl && trendChartEl.querySelector('svg')) {
                // Add to new page if doesn't fit
                doc.addPage();
                yPosition = 20;

                const trendCanvas = await html2canvas(trendChartEl, {
                    backgroundColor: '#ffffff',
                    scale: 2
                });
                const trendImgData = trendCanvas.toDataURL('image/png');
                const trendImgHeight = (trendCanvas.height * imgWidth) / trendCanvas.width;

                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('Monthly Trends', leftMargin, yPosition);
                yPosition += 5;

                doc.addImage(trendImgData, 'PNG', leftMargin, yPosition, imgWidth, Math.min(trendImgHeight, 80));
            }
        }

        // Footer on last page
        const finalY = pageHeight - 15;
        doc.setLineWidth(0.5);
        doc.line(leftMargin, finalY - 5, pageWidth - leftMargin, finalY - 5);
        doc.setFontSize(9);
        doc.setFont(undefined, 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text('TrackMyExpenses - SIDHI', pageWidth / 2, finalY, { align: 'center' });

        // Save PDF
        const fileName = `ExpenseReport.pdf`;
        doc.save(fileName);

        // Show success feedback
        btn.innerHTML = '<i class="fas fa-check"></i> Downloaded!';
        btn.style.background = 'var(--success-gradient)';

        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.background = '';
            btn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF report. Please try again.');
        const btn = document.getElementById('downloadSummaryBtn');
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}
