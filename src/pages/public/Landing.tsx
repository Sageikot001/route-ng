import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getLatestFeaturedVideo } from '../../api/resources';
import type { Resource } from '../../types';

// Helper to convert YouTube URLs to embed format
function getYouTubeEmbedUrl(url: string): string {
  // Handle youtu.be format
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) {
    return `https://www.youtube.com/embed/${shortMatch[1]}`;
  }
  // Handle youtube.com/watch?v= format
  const longMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  if (longMatch) {
    return `https://www.youtube.com/embed/${longMatch[1]}`;
  }
  // Handle youtube.com/embed/ format (already embedded)
  if (url.includes('youtube.com/embed/')) {
    return url;
  }
  return url;
}

export default function Landing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [featuredVideo, setFeaturedVideo] = useState<Resource | null>(null);

  useEffect(() => {
    getLatestFeaturedVideo().then(setFeaturedVideo);
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      question: "What exactly does Route.ng do?",
      answer: "We buy Apple (Naira) gift cards from our partners. These cards have limited use locally, but we operate in markets where there is strong demand. Because of that, we're able to buy them from you and pay you a profit on every transaction."
    },
    {
      question: "How much can I earn?",
      answer: "You earn a profit on every gift card you sell to us. The daily profits may seem small, but when accumulated over time, they can make a noticeable difference. Consistency is key."
    },
    {
      question: "What do I need to get started?",
      answer: "You need an iOS device (iPhone/iPad), an Apple ID, a Mastercard from GTBank, UBA, or Zenith (these banks have the best rates), ₦16,000 minimum capital, and about 10-20 minutes per day."
    },
    {
      question: "Why those specific banks?",
      answer: "We recommend GTBank, UBA, and Zenith because their Mastercard rates work best for the gift card purchase process. Using these banks ensures you get the best value."
    },
    {
      question: "How does the process work?",
      answer: "We inform you of the gift card value we need and the price we're paying. You purchase the card from the App Store, send it to our email, and once confirmed, we send you your payment plus profit."
    },
    {
      question: "How fast do I get paid?",
      answer: "Once we confirm your gift card, payment is sent immediately. The entire process from purchase to payment typically takes just minutes."
    },
    {
      question: "What's a Manager?",
      answer: "Managers recruit and support partners using their referral code. They earn commission on every verified transaction their team makes—a great way to earn passive income."
    },
    {
      question: "Do I need a referral code to join?",
      answer: "No! While you can join through a manager's referral code, you can also register independently. Independent partners join our 'Route.ng Direct' team and have full access to sell gift cards and earn profits."
    },
    {
      question: "Is this legitimate?",
      answer: "Yes. Route.ng operates a legal gift card arbitrage business. We buy cards at Nigerian rates and resell to markets with higher demand. All transactions are tracked and verified through our platform."
    }
  ];

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-logo" onClick={() => navigate('/')}>Route.ng</div>
          <div className="nav-links">
            <a href="#how-it-works">How It Works</a>
            <a href="#plans">Earnings</a>
            <a href="#benefits">Benefits</a>
            <a href="#faq">FAQ</a>
            <button className="nav-login-btn" onClick={() => navigate('/login')}>Login</button>
            <button className="nav-register-btn" onClick={() => navigate('/register')}>Get Started</button>
          </div>
          <button className="mobile-menu-btn" onClick={() => {
            document.querySelector('.nav-links')?.classList.toggle('open');
          }}>
            ☰
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1>Monetize Your iPhone in Just Minutes a Day</h1>
          <p className="hero-subtitle">
            Own an iPhone or iPad? Turn it into a daily income stream. We buy Apple gift cards
            from you at profitable rates. It takes just 10-20 minutes a day.
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="stat-value">₦16k</span>
              <span className="stat-label">Min. to Start</span>
            </div>
            <div className="hero-stat">
              <span className="stat-value">10-20</span>
              <span className="stat-label">Minutes/Day</span>
            </div>
            <div className="hero-stat">
              <span className="stat-value">Daily</span>
              <span className="stat-label">Profit</span>
            </div>
          </div>
          <div className="hero-cta">
            <button className="cta-primary" onClick={() => navigate('/register')}>
              Get Started
            </button>
            <button className="cta-secondary" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
              Learn How It Works
            </button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="phone-mockup">
            <div className="phone-screen">
              <div className="mockup-header">Route.ng</div>
              <div className="mockup-stat">Today's Transaction</div>
              <div className="mockup-amount">₦16,500</div>
              <div className="mockup-detail">
                <div className="mockup-row">
                  <span>Card Value:</span>
                  <span>₦16,000</span>
                </div>
                <div className="mockup-row">
                  <span>Your Profit:</span>
                  <span>₦500</span>
                </div>
                <div className="mockup-row total">
                  <span>You Receive:</span>
                  <span>₦16,500</span>
                </div>
              </div>
              <div className="mockup-text">Payment sent ✓</div>
            </div>
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      {featuredVideo && (
        <section className="video-demo-section">
          <div className="section-container">
            <h2>See How It Works</h2>
            <p className="section-intro">
              Watch our quick demo to understand the process before you start
            </p>
            <div className="video-intro">
              <h3>{featuredVideo.title}</h3>
              {featuredVideo.description && <p>{featuredVideo.description}</p>}
            </div>

            <div className="video-content">
              <div className="video-wrapper">
                {featuredVideo.external_url?.includes('youtube.com') || featuredVideo.external_url?.includes('youtu.be') ? (
                  <iframe
                    src={getYouTubeEmbedUrl(featuredVideo.external_url)}
                    title={featuredVideo.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : featuredVideo.file_url || featuredVideo.external_url ? (
                  <video
                    src={featuredVideo.file_url || featuredVideo.external_url}
                    controls
                    preload="metadata"
                    playsInline
                    poster={featuredVideo.thumbnail_url}
                  />
                ) : null}
              </div>

              <div className="video-highlights">
                <span>In this video you'll learn:</span>
                <ul>
                  <li>How to purchase a gift card in the App Store</li>
                  <li>How to send the card to our email</li>
                  <li>How to log your transaction in Route.ng</li>
                  <li>A quick tour of the partner dashboard</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* What We Do */}
      <section className="what-section">
        <div className="section-container">
          <h2>How It Works</h2>
          <p className="section-intro">
            We buy Apple (Naira) gift cards from our partners. These cards have limited use locally,
            but we operate in markets with strong demand. That's why we can pay you a profit on every transaction.
          </p>
          <div className="what-grid">
            <div className="what-card">
              <div className="what-icon">📢</div>
              <h3>We Inform You</h3>
              <p>We tell you the gift card value we need and the price we're paying for it.</p>
            </div>
            <div className="what-card">
              <div className="what-icon">🛒</div>
              <h3>You Purchase</h3>
              <p>You buy the gift card from the Apple App Store using your iOS device.</p>
            </div>
            <div className="what-card">
              <div className="what-icon">📧</div>
              <h3>You Send</h3>
              <p>Send the gift card to the email we provide. Simple and straightforward.</p>
            </div>
            <div className="what-card">
              <div className="what-icon">💰</div>
              <h3>We Pay You</h3>
              <p>Once confirmed, we send you your payment plus your profit. Done.</p>
            </div>
          </div>
          <p className="section-note">
            It's a simple buy-and-sell system that can be done from your phone in a few minutes each day.
          </p>
        </div>
      </section>

      {/* Requirements Section */}
      <section id="how-it-works" className="requirements-section">
        <div className="section-container">
          <h2>What You Need to Get Started</h2>
          <p className="section-intro">
            To participate, you'll need the following:
          </p>
          <div className="requirements-grid">
            <div className="requirement-card">
              <div className="requirement-icon">📱</div>
              <h3>An iOS Device</h3>
              <p>iPhone or iPad with access to the App Store</p>
            </div>
            <div className="requirement-card">
              <div className="requirement-icon">🍎</div>
              <h3>An Apple ID</h3>
              <p>The email connected to your iOS device</p>
            </div>
            <div className="requirement-card">
              <div className="requirement-icon">💳</div>
              <h3>A Mastercard</h3>
              <p>From GTBank, UBA, or Zenith (these banks have the best rates for this process)</p>
            </div>
            <div className="requirement-card">
              <div className="requirement-icon">💵</div>
              <h3>₦16,000 Minimum Capital</h3>
              <p>This is the typical value of the gift cards we currently purchase</p>
            </div>
            <div className="requirement-card">
              <div className="requirement-icon">⏱️</div>
              <h3>10-20 Minutes Per Day</h3>
              <p>That's all the time you need to complete transactions</p>
            </div>
            <div className="requirement-card">
              <div className="requirement-icon">🎯</div>
              <h3>Consistency & Patience</h3>
              <p>Daily profits add up over time to make a noticeable difference</p>
            </div>
          </div>
        </div>
      </section>

      {/* Get Started Section */}
      <section className="getstarted-section">
        <div className="section-container">
          <h2>Ready to Start?</h2>
          <p className="section-intro">
            If you meet most of the requirements above, you're good to go.
            Register below and we'll guide you through the process step by step.
            No referral code? No problem—you can join independently.
          </p>
          <div className="roles-tabs">
            <div className="role-content">
              <div className="role-column">
                <h3>Join as a Partner</h3>
                <p className="role-desc">Start selling gift cards and earning daily. Have a referral code? Great! Don't have one? Join our independent partners team.</p>
                <div className="steps">
                  <div className="step">
                    <div className="step-number">1</div>
                    <div className="step-content">
                      <h4>Create Your Account</h4>
                      <p>Register with your Apple ID email and add your bank details</p>
                    </div>
                  </div>
                  <div className="step">
                    <div className="step-number">2</div>
                    <div className="step-content">
                      <h4>Choose Your Path</h4>
                      <p>Enter a referral code or join independently—both work!</p>
                    </div>
                  </div>
                  <div className="step">
                    <div className="step-number">3</div>
                    <div className="step-content">
                      <h4>Start Earning</h4>
                      <p>Purchase cards, send them to us, and receive payment with profit</p>
                    </div>
                  </div>
                </div>
                <button className="role-cta" onClick={() => navigate('/register/user')}>
                  Register Now
                </button>
              </div>

              <div className="role-divider"></div>

              <div className="role-column">
                <h3>Become a Manager</h3>
                <p className="role-desc">Build a team and earn commission on their transactions</p>
                <div className="steps">
                  <div className="step">
                    <div className="step-number">1</div>
                    <div className="step-content">
                      <h4>Apply as Manager</h4>
                      <p>Register and get verified as a Route Manager</p>
                    </div>
                  </div>
                  <div className="step">
                    <div className="step-number">2</div>
                    <div className="step-content">
                      <h4>Build Your Team</h4>
                      <p>Recruit partners using your unique referral code</p>
                    </div>
                  </div>
                  <div className="step">
                    <div className="step-number">3</div>
                    <div className="step-content">
                      <h4>Earn Commission</h4>
                      <p>Get paid on every verified transaction your team makes</p>
                    </div>
                  </div>
                </div>
                <button className="role-cta manager" onClick={() => navigate('/register/manager')}>
                  Become a Manager
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="benefits-section">
        <div className="section-container">
          <h2>Why Partner With Route.ng?</h2>
          <div className="benefits-grid">
            <div className="benefit-card">
              <div className="benefit-icon">💰</div>
              <h3>Guaranteed Profit</h3>
              <p>Every transaction earns you a profit. We tell you the rate upfront—no surprises.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">⚡</div>
              <h3>Fast Payment</h3>
              <p>Once we confirm your card, payment is sent immediately to your account.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">⏰</div>
              <h3>Minimal Time Investment</h3>
              <p>Just 10-20 minutes a day. Do it during your break or commute.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">📱</div>
              <h3>Work From Your Phone</h3>
              <p>Everything is done from your iPhone or iPad. No computer needed.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">🛡️</div>
              <h3>Transparent Process</h3>
              <p>Clear rates, tracked transactions, and a dashboard to monitor everything.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">📈</div>
              <h3>Compounding Returns</h3>
              <p>Daily profits may seem small, but they accumulate to make a real difference over time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Work Plans */}
      <section id="plans" className="plans-section">
        <div className="section-container">
          <h2>Your Earning Potential</h2>
          <p className="section-intro">
            Start with what you have. Scale as you grow.
          </p>
          <div className="plans-grid">
            <div className="plan-card">
              <div className="plan-badge starter">Start here</div>
              <h3>Flex Pace</h3>
              <div className="plan-highlight">1 transaction at a time</div>
              <div className="plan-profit">
                <span className="profit-amount">₦250</span>
                <span className="profit-label">per transaction</span>
              </div>
              <ul className="plan-features">
                <li>Complete a transaction, get paid, repeat</li>
                <li>Up to 10 transactions per day</li>
                <li>Perfect for getting started</li>
              </ul>
              <div className="plan-total">
                <span>10 transactions/day =</span>
                <strong>₦2,500 daily profit</strong>
              </div>
              <button className="plan-cta" onClick={() => navigate('/register')}>
                Start Earning
              </button>
            </div>

            <div className="plan-card featured">
              <div className="plan-badge growth">Scale up anytime</div>
              <h3>Power Pace</h3>
              <div className="plan-highlight">Up to 10 transactions at once</div>
              <div className="plan-profit">
                <span className="profit-amount">₦300</span>
                <span className="profit-label">per transaction</span>
              </div>
              <ul className="plan-features">
                <li>Purchase multiple cards in one session</li>
                <li>No waiting between purchases</li>
                <li>Maximize daily earnings</li>
              </ul>
              <div className="plan-total">
                <span>10 transactions/day =</span>
                <strong>₦3,000 daily profit</strong>
              </div>
              <button className="plan-cta" onClick={() => navigate('/register')}>
                Start Earning
              </button>
            </div>
          </div>
          <div className="plans-footer">
            <p className="plans-note">
              <span className="note-icon">🎯</span>
              Most new users start with Flex Pace and scale up to Power Pace when they're more comfortable.
              As your money grows, so does your trust in our business model.
            </p>
            <p className="plans-minimum">
              <span className="note-icon">💡</span>
              All you need is <strong>₦16,000</strong> to begin your first transaction today.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="faq-section">
        <div className="section-container">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`faq-item ${openFaq === index ? 'open' : ''}`}
                onClick={() => toggleFaq(index)}
              >
                <div className="faq-question">
                  <span>{faq.question}</span>
                  <span className="faq-toggle">{openFaq === index ? '−' : '+'}</span>
                </div>
                {openFaq === index && (
                  <div className="faq-answer">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="section-container">
          <h2>Ready to Start Selling?</h2>
          <p>Join thousands of Nigerians who sell their gift cards to Route.ng daily.</p>
          <div className="cta-buttons">
            <button className="cta-primary large" onClick={() => navigate('/register')}>
              Create Your Account
            </button>
            <button className="cta-secondary large" onClick={() => navigate('/login')}>
              Login to Dashboard
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <h3>Route.ng</h3>
            <p>Nigeria's trusted gift card buyer. Sell your cards, get paid instantly.</p>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>Quick Links</h4>
              <a href="#how-it-works">How It Works</a>
              <a href="#benefits">Benefits</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="footer-column">
              <h4>Get Started</h4>
              <a onClick={() => navigate('/register/user')}>Register as User</a>
              <a onClick={() => navigate('/register/manager')}>Register as Manager</a>
              <a onClick={() => navigate('/login')}>Login</a>
            </div>
            <div className="footer-column">
              <h4>Contact</h4>
              <a href="mailto:support@route.ng">support@route.ng</a>
              <a href="https://t.me/+HU92YsjyDbMzMDZk" target="_blank" rel="noopener noreferrer">Join our Telegram community</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Route.ng. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
