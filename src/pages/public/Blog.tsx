import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type TabType = 'about' | 'how-it-works' | 'faq' | 'terms';

export default function Blog() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('about');

  return (
    <div className="blog-page">
      <header className="blog-header">
        <div className="blog-header-content">
          <h1 className="blog-logo" onClick={() => navigate('/')}>Route.ng</h1>
          <nav className="blog-nav">
            <button onClick={() => navigate('/login')}>Login</button>
            <button className="primary" onClick={() => navigate('/')}>Get Started</button>
          </nav>
        </div>
      </header>

      <div className="blog-hero">
        <h1>Welcome to Route.ng</h1>
        <p>Nigeria's leading platform for scaled Apple gift card purchases</p>
      </div>

      <div className="blog-tabs">
        <button
          className={activeTab === 'about' ? 'active' : ''}
          onClick={() => setActiveTab('about')}
        >
          About Us
        </button>
        <button
          className={activeTab === 'how-it-works' ? 'active' : ''}
          onClick={() => setActiveTab('how-it-works')}
        >
          How It Works
        </button>
        <button
          className={activeTab === 'faq' ? 'active' : ''}
          onClick={() => setActiveTab('faq')}
        >
          FAQ
        </button>
        <button
          className={activeTab === 'terms' ? 'active' : ''}
          onClick={() => setActiveTab('terms')}
        >
          Terms
        </button>
      </div>

      <div className="blog-content">
        {activeTab === 'about' && (
          <div className="content-section">
            <h2>About Route.ng</h2>
            <p>
              Route.ng is a Nigerian platform that enables scaled Apple gift card purchases
              by partnering with iOS users across the country. We create opportunities for
              Nigerians to earn consistent income by leveraging their Apple accounts.
            </p>

            <h3>Our Mission</h3>
            <p>
              To provide a reliable, transparent platform where iOS users can earn money
              by completing simple transactions, while building a community of trusted
              participants managed by verified team leaders.
            </p>

            <h3>What We Offer</h3>
            <div className="feature-grid">
              <div className="feature-card">
                <span className="feature-icon">💰</span>
                <h4>Daily Earnings</h4>
                <p>Earn N2,500 daily by completing your transaction target</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">👥</span>
                <h4>Team Support</h4>
                <p>Work under verified managers who guide and support you</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">🔒</span>
                <h4>Secure Platform</h4>
                <p>Multi-tier verification ensures transaction integrity</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">📱</span>
                <h4>Easy Process</h4>
                <p>Simple mobile-friendly interface for logging transactions</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'how-it-works' && (
          <div className="content-section">
            <h2>How It Works</h2>

            <div className="steps-container">
              <div className="step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h3>Register & Get Verified</h3>
                  <p>
                    Sign up as an iOS User and connect with a verified manager.
                    Provide your Apple ID and bank account details for receiving payments.
                  </p>
                </div>
              </div>

              <div className="step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h3>Receive Funding</h3>
                  <p>
                    Once verified, you'll receive funding in your account to make
                    Apple gift card purchases. The funding amount determines your daily target.
                  </p>
                </div>
              </div>

              <div className="step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h3>Complete Transactions</h3>
                  <p>
                    Purchase gift cards using your Apple account and log each transaction
                    with a screenshot proof. Your daily target is 10 transactions per registered bank.
                  </p>
                </div>
              </div>

              <div className="step">
                <div className="step-number">4</div>
                <div className="step-content">
                  <h3>Get Verified & Paid</h3>
                  <p>
                    Your manager reviews your transactions, then admin verifies.
                    Complete your daily target to earn N2,500.
                  </p>
                </div>
              </div>
            </div>

            <div className="roles-section">
              <h3>User Roles</h3>
              <div className="roles-grid">
                <div className="role-card">
                  <h4>iOS User</h4>
                  <p>Completes gift card purchases and earns daily payouts</p>
                  <span className="earning">Earns: N2,500/day</span>
                </div>
                <div className="role-card">
                  <h4>Manager</h4>
                  <p>Manages a team of iOS users and reviews transactions</p>
                  <span className="earning">Earns: Commission on team earnings</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'faq' && (
          <div className="content-section">
            <h2>Frequently Asked Questions</h2>

            <div className="faq-list">
              <div className="faq-item">
                <h3>How much can I earn?</h3>
                <p>
                  iOS Users earn N2,500 per day when they complete their daily transaction target.
                  Your target is 10 transactions per registered bank account. More banks = higher target = same daily pay.
                </p>
              </div>

              <div className="faq-item">
                <h3>What do I need to get started?</h3>
                <p>
                  You need an Apple ID (iCloud account), a Nigerian bank account, and a smartphone.
                  You'll also need to join a verified manager's team.
                </p>
              </div>

              <div className="faq-item">
                <h3>How do I find a manager?</h3>
                <p>
                  You can either get a referral link from an existing manager or select from
                  available verified managers during registration.
                </p>
              </div>

              <div className="faq-item">
                <h3>When do I get paid?</h3>
                <p>
                  Payments are processed after your transactions are verified. Your manager
                  reviews first, then admin confirms. Payouts are made to your registered bank account.
                </p>
              </div>

              <div className="faq-item">
                <h3>What happens if my transaction is rejected?</h3>
                <p>
                  Rejected transactions don't count toward your daily target. You'll see the
                  rejection reason in your transaction history. Repeated rejections may affect
                  your standing.
                </p>
              </div>

              <div className="faq-item">
                <h3>Can I register multiple bank accounts?</h3>
                <p>
                  Yes! You can add multiple banks to your profile. Each bank adds 10 transactions
                  to your daily target. Add more banks to increase your responsibilities.
                </p>
              </div>

              <div className="faq-item">
                <h3>How do I become a Manager?</h3>
                <p>
                  Register as a Manager and wait for admin verification. Once verified, you can
                  start recruiting iOS users to your team using your referral code.
                </p>
              </div>

              <div className="faq-item">
                <h3>What if I need help with Apple purchases?</h3>
                <p>
                  Contact Apple Support directly for any issues with your Apple account or purchases.
                  There's a direct link to Apple Support in your dashboard.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'terms' && (
          <div className="content-section">
            <h2>Terms of Service</h2>

            <div className="terms-content">
              <h3>1. Acceptance of Terms</h3>
              <p>
                By accessing and using Route.ng, you agree to be bound by these Terms of Service
                and all applicable laws and regulations.
              </p>

              <h3>2. User Responsibilities</h3>
              <p>As a user of Route.ng, you agree to:</p>
              <ul>
                <li>Provide accurate and truthful information during registration</li>
                <li>Complete transactions honestly and submit genuine proof</li>
                <li>Not engage in fraudulent activities or submit false transaction records</li>
                <li>Maintain the security of your account credentials</li>
                <li>Comply with Apple's terms of service for gift card purchases</li>
              </ul>

              <h3>3. Transaction Verification</h3>
              <p>
                All transactions are subject to multi-tier verification. Route.ng reserves the
                right to reject transactions that appear fraudulent or do not meet verification
                standards.
              </p>

              <h3>4. Payment Terms</h3>
              <p>
                Payments are made only for verified transactions. Daily targets must be met to
                qualify for the daily payout. Route.ng reserves the right to withhold payment
                pending investigation of suspicious activity.
              </p>

              <h3>5. Account Suspension</h3>
              <p>
                Accounts may be suspended or terminated for violations of these terms, including
                but not limited to: submitting false transactions, providing incorrect bank details,
                or any form of fraudulent activity.
              </p>

              <h3>6. Manager Responsibilities</h3>
              <p>
                Managers are responsible for the accuracy of transactions submitted by their team
                members. Repeated approval of fraudulent transactions may result in manager
                account suspension.
              </p>

              <h3>7. Modifications</h3>
              <p>
                Route.ng reserves the right to modify these terms at any time. Continued use of
                the platform after modifications constitutes acceptance of the new terms.
              </p>

              <h3>8. Contact</h3>
              <p>
                For questions about these terms, please contact your manager or reach out through
                the platform's support channels.
              </p>
            </div>
          </div>
        )}
      </div>

      <footer className="blog-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>Route.ng</h4>
            <p>Empowering Nigerians through Apple gift card transactions</p>
          </div>
          <div className="footer-section">
            <h4>Quick Links</h4>
            <a href="#" onClick={() => setActiveTab('about')}>About Us</a>
            <a href="#" onClick={() => setActiveTab('faq')}>FAQ</a>
            <a href="#" onClick={() => setActiveTab('terms')}>Terms</a>
          </div>
          <div className="footer-section">
            <h4>Support</h4>
            <a href="https://support.apple.com/contact" target="_blank" rel="noopener noreferrer">
              Apple Support
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Route.ng. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
