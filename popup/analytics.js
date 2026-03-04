/* popup/analytics.js */

export function initAnalytics() {
    // Refresh data whenever the analytics view is shown
    document.addEventListener('viewChanged', (e) => {
        if (e.detail.viewName === 'analyticsView') {
            loadAnalyticsData();
        }
    });

    // Initial check in case it's already visible (restored from storage)
    const analyticsView = document.getElementById('analyticsView');
    if (analyticsView && !analyticsView.classList.contains('hidden')) {
        loadAnalyticsData();
    }
}

let isLoading = false;

async function loadAnalyticsData() {
    if (isLoading) return;
    isLoading = true;
    try {
        // Parallel Fetch via Background Script
        const [weeklyStatsRes, badgesStatsRes] = await Promise.all([
            new Promise(resolve => chrome.runtime.sendMessage({ action: 'getWeeklyStats' }, resolve)),
            new Promise(resolve => chrome.runtime.sendMessage({ action: 'getBadgesStats' }, resolve))
        ]);

        if (!weeklyStatsRes?.success || !badgesStatsRes?.success) {
            throw new Error(weeklyStatsRes?.error || badgesStatsRes?.error || "Failed to fetch stats");
        }

        const weeklyStats = weeklyStatsRes.data;
        const badgesStats = badgesStatsRes.data;

        if (weeklyStats) {
            updateSummaryCards(weeklyStats);
            renderWeeklyChart(weeklyStats.daily_breakdown);
        }

        if (badgesStats) {
            renderBadges(badgesStats.earned_badges);
            updateProgress(badgesStats.progress_to_next_badge);
        }

        document.getElementById('analyticsDate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    } catch (error) {
        console.error("Failed to load analytics:", error);
        let errorText = error.message || "Failed to load data.";
        errorText = errorText.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: #3B82F6; text-decoration: underline;">$1</a>');
        document.getElementById('weeklyChart').innerHTML = `<div style="text-align:center; padding:20px; color:red; font-size:12px;">${errorText} <br><br> <button class="btn-ghost" id="retryAnalyticsBtn">Retry</button></div>`;
        document.getElementById('retryAnalyticsBtn').onclick = () => loadAnalyticsData();
    } finally {
        isLoading = false;
    }
}


function updateSummaryCards(data) {
    document.getElementById('statToday').textContent = data.today_count || 0;
    document.getElementById('statWeekly').textContent = data.weekly_total || 0;
    document.getElementById('statStreak').textContent = (data.streak || 0) + '🔥';
}

function renderWeeklyChart(breakdown) {
    const container = document.getElementById('weeklyChart');
    container.innerHTML = '';

    if (!breakdown || breakdown.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align:center;">No data</p>';
        return;
    }

    // Find max for scaling
    const maxVal = Math.max(...breakdown.map(d => d.count)) || 1;

    breakdown.forEach(day => {
        const barHeight = (day.count / maxVal) * 100;

        const barWrapper = document.createElement('div');
        barWrapper.className = 'chart-bar-wrapper';

        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = `${Math.max(barHeight, 5)}%`; // Min 5% for visibility
        bar.title = `${day.date}: ${day.count}`;

        const label = document.createElement('div');
        label.className = 'chart-label';
        // Extract generic day name if possible, assuming date string
        // If date is "2023-10-10", maybe just show Day. Mock says "Mon"
        const dateObj = new Date(day.date);
        label.textContent = isNaN(dateObj) ? day.date : dateObj.toLocaleDateString('en-US', { weekday: 'short' });

        barWrapper.appendChild(bar);
        barWrapper.appendChild(label);
        container.appendChild(barWrapper);
    });
}

function renderBadges(badges) {
    const grid = document.getElementById('badgesGrid');
    grid.innerHTML = '';

    if (!badges || badges.length === 0) {
        grid.innerHTML = '<p class="text-muted" style="font-size:12px;">No badges yet.</p>';
        return;
    }

    badges.forEach(badge => {
        const div = document.createElement('div');
        div.className = 'badge-item';
        div.innerHTML = `
            <div class="badge-icon">${badge.icon || '🏆'}</div>
            <div class="badge-name">${badge.name}</div>
        `;
        grid.appendChild(div);
    });
}

function updateProgress(progress) {
    if (!progress) return;

    document.getElementById('nextBadgeLabel').textContent = `Next: ${progress.name}`;
    document.getElementById('nextBadgeProgress').style.width = `${progress.percentage}%`;
    document.getElementById('nextBadgeText').textContent = `${progress.percentage}% (${progress.description || ''})`;
}
