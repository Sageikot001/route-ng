import { useState, useRef } from 'react';

interface TermsAgreementModalProps {
  onAccept: () => void;
  isLoading?: boolean;
}

export default function TermsAgreementModal({ onAccept, isLoading }: TermsAgreementModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasCheckedBox, setHasCheckedBox] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      // Consider "scrolled to bottom" when within 50px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 50) {
        setHasScrolledToBottom(true);
      }
    }
  };

  const canProceed = hasScrolledToBottom && hasCheckedBox;

  return (
    <div className="terms-modal-overlay">
      <div className="terms-modal">
        <div className="terms-modal-header">
          <div className="terms-modal-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h2>Updated Terms and Conditions</h2>
          <p className="terms-modal-subtitle">
            We've updated our Terms and Conditions. Please review and accept them to continue using Route.ng.
          </p>
        </div>

        <div
          className="terms-modal-content"
          ref={contentRef}
          onScroll={handleScroll}
        >
          <section className="terms-section">
            <h3>1. Introduction</h3>
            <p>
              Welcome to Route.ng. These Terms and Conditions govern your use of our platform
              and services. By using our services, you agree to be bound by these Terms.
            </p>
          </section>

          <section className="terms-section">
            <h3>2. Transaction Requirements</h3>
            <div className="terms-important">
              <p>
                <strong>IMPORTANT:</strong> You MUST purchase and send gift cards in the
                EXACT amount specified. Our clients are very specific about amounts.
              </p>
              <ul>
                <li>Sending more or less = <strong>ENTIRE amount lost</strong> (card non-tradeable)</li>
                <li>You AND your manager bear the full cost, NOT Route.ng</li>
                <li>No exceptions for incorrect amounts</li>
              </ul>
            </div>
          </section>

          <section className="terms-section">
            <h3>3. Incorrect Amount Disclaimer</h3>
            <div className="terms-disclaimer">
              <p><strong>BY USING THIS PLATFORM, YOU ACKNOWLEDGE AND AGREE:</strong></p>
              <ul>
                <li>
                  <strong>Excess Amounts:</strong> The ENTIRE amount is lost. You AND your
                  manager bear the full cost, NOT Route.ng.
                </li>
                <li>
                  <strong>Insufficient Amounts:</strong> The ENTIRE amount is lost. Route.ng
                  will assume fraudulent intent. You AND your manager bear the cost.
                </li>
              </ul>
            </div>
          </section>

          <section className="terms-section">
            <h3>4. Wrong Address Disclaimer</h3>
            <div className="terms-disclaimer">
              <p><strong>BY USING THIS PLATFORM, YOU ACKNOWLEDGE AND AGREE:</strong></p>
              <ul>
                <li>You are solely responsible for verifying the recipient email address</li>
                <li>Visit the Resource Center for recovery guidance or contact support</li>
                <li>Route.ng will make best efforts but CANNOT guarantee recovery</li>
                <li>You waive any claims against Route.ng for losses due to address errors</li>
              </ul>
            </div>
          </section>

          <section className="terms-section">
            <h3>5. User Responsibilities</h3>
            <ul>
              <li>Purchase gift cards directly from the App Store (recommended)</li>
              <li>Send exact amounts as specified</li>
              <li>Verify recipient email addresses before sending</li>
              <li>ALWAYS log your transactions on the platform</li>
              <li>Have records of your transactions for confirmation</li>
              <li>Maintain account security</li>
            </ul>
          </section>

          <section className="terms-section">
            <h3>6. Prohibited Activities</h3>
            <p>The following result in immediate account termination:</p>
            <ul>
              <li>Submitting fraudulent or stolen codes</li>
              <li>Attempting to redeem the same code multiple times</li>
              <li>Creating multiple accounts</li>
              <li>Manipulating transaction records</li>
              <li>Money laundering or illegal activities</li>
            </ul>
          </section>

          <section className="terms-section">
            <h3>7. Code Validity</h3>
            <p>Route.ng is NOT responsible for:</p>
            <ul>
              <li>Gift card codes that have already been redeemed</li>
              <li>Expired codes</li>
              <li>Codes from unauthorized sources</li>
            </ul>
            <p><strong>Recommendation:</strong> Buy directly from App Store and send immediately to our provided emails. See Resource Center videos.</p>
          </section>

          <section className="terms-section">
            <h3>8. Payment Terms</h3>
            <ul>
              <li>Earnings credited upon successful verification</li>
              <li>Minimum withdrawal thresholds may apply</li>
              <li>Disputes must be raised within 7 days</li>
            </ul>
          </section>

          <section className="terms-section">
            <h3>9. Account Termination</h3>
            <p>
              Route.ng reserves the right to suspend or terminate accounts for violations
              of these Terms, suspicious activity, or at our discretion with reasonable cause.
            </p>
          </section>

          <section className="terms-section terms-summary">
            <h3>Summary of Key Points</h3>
            <table className="terms-table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Correct amount, correct address</td>
                  <td>Full payment processed</td>
                </tr>
                <tr>
                  <td>More than requested</td>
                  <td>Full loss - User & Manager bear cost</td>
                </tr>
                <tr>
                  <td>Less than requested</td>
                  <td>Full loss - User & Manager bear cost</td>
                </tr>
                <tr>
                  <td>Wrong address</td>
                  <td>Best-effort recovery only</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="terms-section">
            <h3>10. Governing Law</h3>
            <p>
              These Terms are governed by the laws of the Federal Republic of Nigeria.
            </p>
          </section>

          <div className="terms-end-marker">
            <p>— End of Terms and Conditions —</p>
            <p className="terms-version">Version 1.0 | March 28, 2026</p>
          </div>
        </div>

        {!hasScrolledToBottom && (
          <div className="terms-scroll-hint">
            <span>Scroll down to read all terms</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        )}

        <div className="terms-modal-footer">
          <label className={`terms-checkbox-label ${!hasScrolledToBottom ? 'disabled' : ''}`}>
            <input
              type="checkbox"
              checked={hasCheckedBox}
              onChange={(e) => setHasCheckedBox(e.target.checked)}
              disabled={!hasScrolledToBottom}
            />
            <span>
              I have read, understood, and agree to the Terms and Conditions
            </span>
          </label>

          <button
            className="primary-btn terms-accept-btn"
            onClick={onAccept}
            disabled={!canProceed || isLoading}
          >
            {isLoading ? 'Processing...' : 'Accept and Continue'}
          </button>

          <p className="terms-footer-note">
            By clicking "Accept and Continue", you confirm your agreement to these terms.
          </p>
        </div>
      </div>
    </div>
  );
}
