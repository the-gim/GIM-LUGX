// Web Analytics Tracker
class WebAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.userId = this.getUserId();
        this.startTime = Date.now();
        this.maxScrollDepth = 0;
        this.clickCount = 0;
        
        // Try to determine the analytics service URL
        this.analyticsUrl = this.getAnalyticsUrl();
        
        console.log('Analytics initialized:', {
            sessionId: this.sessionId,
            userId: this.userId,
            analyticsUrl: this.analyticsUrl
        });
        
        this.init();
    }

    getAnalyticsUrl() {
        // If running on the same domain, use relative path
        if (window.location.hostname.includes('elb.amazonaws.com')) {
            // For LoadBalancer setup, we need to route through the same endpoint
            return '/api/analytics';
        }
        // For local testing
        return 'http://localhost:8080/api/analytics';
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

    async sendEvent(eventData) {
        try {
            console.log('Sending analytics event:', eventData.type, eventData);
            
            const response = await fetch(this.analyticsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData)
            });
            
            if (response.ok) {
                console.log('Analytics event sent successfully:', eventData.type);
            } else {
                console.error('Analytics error:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Failed to send analytics:', error);
        }
    }

    trackPageView() {
        const pageData = {
            type: 'page_view',
            session_id: this.sessionId,
            user_id: this.userId,
            page_url: window.location.href,
            page_title: document.title,
            referrer: document.referrer,
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString()
        };
        
        this.sendEvent(pageData);
    }

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
                element_text: (event.target.textContent || '').substring(0, 100),
                click_x: event.clientX,
                click_y: event.clientY,
                timestamp: new Date().toISOString()
            };
            
            this.sendEvent(clickData);
        });
    }

    setupScrollTracking() {
        let scrollTimeout;
        
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const scrollTop = window.pageYOffset;
                const docHeight = document.documentElement.scrollHeight - window.innerHeight;
                const scrollPercent = Math.round((scrollTop / docHeight) * 100);
                
                if (scrollPercent > this.maxScrollDepth && scrollPercent <= 100) {
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
            if (navigator.sendBeacon) {
                navigator.sendBeacon(this.analyticsUrl, JSON.stringify(sessionData));
            }
        });
    }
}

// Initialize analytics when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.webAnalytics = new WebAnalytics();
    });
} else {
    window.webAnalytics = new WebAnalytics();
}

// Manual tracking function
window.trackCustomEvent = function(eventType, eventData) {
    if (window.webAnalytics) {
        const customData = {
            type: eventType,
            session_id: window.webAnalytics.sessionId,
            user_id: window.webAnalytics.userId,
            page_url: window.location.href,
            timestamp: new Date().toISOString(),
            ...eventData
        };
        window.webAnalytics.sendEvent(customData);
    }
};