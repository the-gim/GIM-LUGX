class WebAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.userId = this.getUserId();
        this.startTime = Date.now();
        this.maxScrollDepth = 0;
        this.clickCount = 0;
        this.apiEndpoint = '/api/analytics'; // Your analytics service endpoint
        
        this.init();
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    getUserId() {
        let userId = localStorage.getItem('analytics_user_id');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('analytics_user_id', userId);
        }
        return userId;
    }

    init() {
        this.trackPageView();
        this.setupClickTracking();
        this.setupScrollTracking();
        this.setupUnloadTracking();
    }

    // Track Page Views
    trackPageView() {
        const pageData = {
            type: 'page_view',
            session_id: this.sessionId,
            user_id: this.userId,
            page_url: window.location.href,
            page_title: document.title,
            referrer: document.referrer,
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            load_time: performance.now()
        };
        
        this.sendEvent(pageData);
    }

    // Track Clicks
    setupClickTracking() {
        document.addEventListener('click', (event) => {
            this.clickCount++;
            
            const clickData = {
                type: 'click',
                session_id: this.sessionId,
                user_id: this.userId,
                page_url: window.location.href,
                element_type: event.target.tagName.toLowerCase(),
                element_id: event.target.id || '',
                element_class: event.target.className || '',
                element_text: event.target.textContent?.substring(0, 100) || '',
                click_x: event.clientX,
                click_y: event.clientY,
                timestamp: new Date().toISOString()
            };
            
            this.sendEvent(clickData);
        });
    }

    // Track Scroll Depth
    setupScrollTracking() {
        let scrollTimeout;
        
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const scrollTop = window.pageYOffset;
                const docHeight = document.documentElement.scrollHeight - window.innerHeight;
                const scrollPercent = Math.round((scrollTop / docHeight) * 100);
                
                if (scrollPercent > this.maxScrollDepth) {
                    this.maxScrollDepth = scrollPercent;
                    
                    const scrollData = {
                        type: 'scroll',
                        session_id: this.sessionId,
                        user_id: this.userId,
                        page_url: window.location.href,
                        scroll_depth_percent: scrollPercent,
                        max_scroll_depth: this.maxScrollDepth,
                        page_height: document.documentElement.scrollHeight,
                        viewport_height: window.innerHeight,
                        timestamp: new Date().toISOString()
                    };
                    
                    this.sendEvent(scrollData);
                }
            }, 100);
        });
    }

    // Track Session End
    setupUnloadTracking() {
        window.addEventListener('beforeunload', () => {
            const sessionData = {
                type: 'session_end',
                session_id: this.sessionId,
                user_id: this.userId,
                duration: Math.round((Date.now() - this.startTime) / 1000),
                click_count: this.clickCount,
                max_scroll_depth: this.maxScrollDepth,
                timestamp: new Date().toISOString()
            };
            
            // Use sendBeacon for reliable delivery on page unload
            navigator.sendBeacon(this.apiEndpoint, JSON.stringify(sessionData));
        });
    }

    // Send events to analytics service
    async sendEvent(eventData) {
        try {
            await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData)
            });
        } catch (error) {
            console.error('Analytics tracking error:', error);
        }
    }
}

// Initialize analytics when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.analytics = new WebAnalytics();
});

// Export for manual tracking
window.trackCustomEvent = (eventType, eventData) => {
    if (window.analytics) {
        const customData = {
            type: eventType,
            session_id: window.analytics.sessionId,
            user_id: window.analytics.userId,
            page_url: window.location.href,
            timestamp: new Date().toISOString(),
            ...eventData
        };
        window.analytics.sendEvent(customData);
    }
};