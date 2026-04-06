import { useNavigate } from 'react-router-dom';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="terms-page">
      <div className="terms-container">
        <header className="terms-header">
          <h1>Terms and Conditions</h1>
          <p className="terms-updated">Last Updated: March 28, 2026 | Version 1.0</p>
        </header>

        <div className="terms-content">
          <section className="terms-section">
            <h2>1. Introduction</h2>
            <p>
              Welcome to Route.ng. These Terms and Conditions ("Terms") govern your use of our
              platform and services. By registering for an account or using our services, you
              agree to be bound by these Terms. Please read them carefully.
            </p>
            <p>
              Route.ng facilitates Apple Gift Card transactions between partners (users) and
              the platform. Our role is to coordinate transactions, verify receipts, and process
              payments according to our established procedures.
            </p>
          </section>

          <section className="terms-section">
            <h2>2. Definitions</h2>
            <ul>
              <li><strong>"Platform"</strong> refers to Route.ng, including our website, applications, and services</li>
              <li><strong>"Partner"</strong> or <strong>"User"</strong> refers to any registered iOS user who participates in transactions</li>
              <li><strong>"Manager"</strong> refers to team leaders who oversee groups of partners</li>
              <li><strong>"Transaction"</strong> refers to the purchase and redemption of Apple Gift Cards through our platform</li>
              <li><strong>"Transaction Opportunity"</strong> refers to a specific request for gift card purchases with defined amounts</li>
              <li><strong>"Requested Amount"</strong> refers to the exact gift card denomination specified in a Transaction Opportunity</li>
            </ul>
          </section>

          <section className="terms-section">
            <h2>3. Transaction Requirements</h2>

            <h3>3.1 Exact Amount Compliance</h3>
            <div className="terms-important">
              <p>
                <strong>IMPORTANT:</strong> When participating in a Transaction Opportunity, you MUST
                purchase and send gift cards in the EXACT amount specified.
              </p>
              <ul>
                <li>If a transaction requests a N10,000 gift card, you must send exactly N10,000</li>
                <li>Sending more or less than the requested amount constitutes a <strong>non-compliant transaction</strong></li>
                <li>Non-compliant transactions will be marked as <strong>INVALID</strong> and will not be processed for payment</li>
              </ul>
            </div>

            <p><strong>We cannot and will not:</strong></p>
            <ul>
              <li>Credit you for amounts exceeding the requested value</li>
              <li>Process partial payments for amounts less than requested</li>
              <li>Combine multiple incorrect amounts to meet a target</li>
              <li>Make exceptions for "close enough" amounts</li>
            </ul>

            <h3>3.2 Correct Recipient Address</h3>
            <p>All gift cards must be sent to the email address provided by Route.ng for that specific transaction.</p>
            <ul>
              <li>Double-check the recipient email before sending</li>
              <li>Verify you are sending to the designated address provided by Route.ng</li>
              <li>Have records of your transactions for confirmation</li>
            </ul>
          </section>

          <section className="terms-section">
            <h2>4. Disclaimers and Liability Limitations</h2>

            <h3>4.1 Incorrect Amount Disclaimer</h3>
            <div className="terms-disclaimer">
              <p><strong>BY USING THIS PLATFORM, YOU ACKNOWLEDGE AND AGREE THAT:</strong></p>
              <p>
                Route.ng will NOT be held responsible or liable for transactions where the gift
                card amount does not match the requested amount. Our clients are very specific about
                the amounts they deal in.
              </p>
              <ul>
                <li>
                  <strong>Excess Amounts:</strong> If you send a gift card worth more than the
                  requested amount, the ENTIRE amount is lost as the card becomes non-tradeable.
                  You AND your manager will bear the full cost of this transaction, NOT Route.ng.
                </li>
                <li>
                  <strong>Insufficient Amounts:</strong> If you send a gift card worth less than
                  the requested amount, the ENTIRE amount is lost. Route.ng will assume fraudulent
                  intent. You AND your manager will bear the full cost, NOT Route.ng.
                </li>
                <li>
                  <strong>Multiple Cards:</strong> If you attempt to combine multiple smaller
                  cards to reach a requested amount without prior approval, the transaction may
                  be rejected.
                </li>
              </ul>
            </div>

            <h3>4.2 Wrong Address Disclaimer</h3>
            <div className="terms-disclaimer">
              <p><strong>BY USING THIS PLATFORM, YOU ACKNOWLEDGE AND AGREE THAT:</strong></p>
              <p>
                Route.ng will NOT be held responsible or liable for gift cards sent to incorrect
                email addresses.
              </p>
              <ul>
                <li>
                  <strong>Recovery Attempts:</strong> Visit the Resource Center for guidance on
                  recovery procedures. Contact support immediately for assistance. Route.ng will
                  make best efforts but CANNOT guarantee recovery.
                </li>
                <li>
                  <strong>No Guarantee:</strong> Route.ng CANNOT guarantee successful recovery of
                  misdirected funds, compensation for unrecoverable transactions, or reimbursement
                  from Apple or third parties.
                </li>
                <li>
                  <strong>User Responsibility:</strong> The partner bears full responsibility for
                  verifying the recipient email address before sending and ensuring accuracy of
                  all transaction details.
                </li>
                <li>
                  <strong>Liability Waiver:</strong> By using our platform, you expressly waive
                  any claims against Route.ng for losses resulting from typographical errors in
                  email addresses, sending to outdated or incorrect addresses, or failure to
                  follow provided instructions.
                </li>
              </ul>
            </div>

            <h3>4.3 General Transaction Disclaimers</h3>
            <ul>
              <li>
                <strong>Processing Times:</strong> Route.ng processes verified transactions within
                our stated timeframes but is not liable for delays caused by bank processing times,
                network issues, verification requirements, or third-party service interruptions.
              </li>
              <li>
                <strong>Code Validity:</strong> Route.ng is not responsible for gift card codes
                that have already been redeemed, expired codes, codes purchased from unauthorized
                sources, or fraudulent/stolen codes. We recommend buying directly from the App Store
                and sending immediately to the email addresses we provide, as shown in the videos
                in the Resource Center.
              </li>
              <li>
                <strong>Transaction Logging:</strong> You MUST always log your transactions on the
                platform. Have records of your transactions for confirmation. Incomplete or missing
                logs may delay or void your transaction verification. Visit the Resource Center for
                guidance on proper logging procedures.
              </li>
            </ul>
          </section>

          <section className="terms-section">
            <h2>5. User Responsibilities</h2>
            <p>As a Route.ng partner, you agree to:</p>

            <h3>5.1 Transaction Compliance</h3>
            <ul>
              <li>Purchase gift cards directly from the App Store (recommended)</li>
              <li>Send exact amounts as specified in Transaction Opportunities</li>
              <li>Use only the email addresses provided by the platform</li>
              <li>ALWAYS log your transactions on the platform immediately</li>
              <li>Have records of your transactions for confirmation</li>
            </ul>

            <h3>5.2 Account Security</h3>
            <ul>
              <li>Maintain the confidentiality of your login credentials</li>
              <li>Notify Route.ng immediately of any unauthorized account access</li>
              <li>Use accurate and up-to-date personal and banking information</li>
              <li>Not share your account with others</li>
            </ul>

            <h3>5.3 Honest Conduct</h3>
            <ul>
              <li>Provide truthful information in all interactions</li>
              <li>Not attempt to manipulate or defraud the platform</li>
              <li>Report any errors or discrepancies promptly</li>
              <li>Cooperate with verification processes</li>
            </ul>
          </section>

          <section className="terms-section">
            <h2>6. Prohibited Activities</h2>
            <p>The following activities are strictly prohibited and may result in immediate account termination:</p>
            <ul>
              <li>Submitting fraudulent or stolen gift card codes</li>
              <li>Attempting to redeem the same code multiple times</li>
              <li>Creating multiple accounts to circumvent limits</li>
              <li>Manipulating transaction records or receipts</li>
              <li>Engaging in money laundering or illegal activities</li>
              <li>Harassing platform staff or other users</li>
              <li>Attempting to reverse-engineer or hack the platform</li>
            </ul>
          </section>

          <section className="terms-section">
            <h2>7. Account Termination</h2>
            <p>Route.ng reserves the right to suspend or terminate accounts for:</p>
            <ul>
              <li>Violation of these Terms and Conditions</li>
              <li>Suspicious or fraudulent activity</li>
              <li>Non-compliance with transaction requirements</li>
              <li>Extended periods of inactivity</li>
              <li>At our sole discretion with reasonable cause</li>
            </ul>
            <p>
              Upon termination, pending verified transactions will be processed, but unverified
              transactions may be forfeited and access to the platform will be revoked.
            </p>
          </section>

          <section className="terms-section">
            <h2>8. Payment Terms</h2>
            <ul>
              <li>Earnings are credited upon successful verification of transactions</li>
              <li>Payment rates are set by the platform and may change with notice</li>
              <li>Minimum withdrawal thresholds may apply</li>
              <li>Withdrawals are processed to registered bank accounts only</li>
              <li>Payment disputes must be raised within 7 days of transaction</li>
            </ul>
          </section>

          <section className="terms-section">
            <h2>9. Privacy and Data</h2>
            <p>Your use of Route.ng is also governed by our Privacy Policy. By using our services, you consent to:</p>
            <ul>
              <li>Collection of transaction data for verification</li>
              <li>Storage of personal and banking information</li>
              <li>Communication via email and in-app notifications</li>
              <li>Sharing of necessary data with payment processors</li>
            </ul>
          </section>

          <section className="terms-section">
            <h2>10. Modifications to Terms</h2>
            <p>
              Route.ng reserves the right to modify these Terms at any time. Changes will be
              communicated through in-app announcements, email notifications, and updates to
              this document. Continued use of the platform after changes constitutes acceptance
              of modified Terms.
            </p>
          </section>

          <section className="terms-section">
            <h2>11. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the Federal Republic of Nigeria. Any
              disputes shall be resolved through appropriate legal channels within Nigerian jurisdiction.
            </p>
          </section>

          <section className="terms-section">
            <h2>12. Contact Information</h2>
            <p>For questions, concerns, or disputes regarding these Terms:</p>
            <ul>
              <li><strong>Email:</strong> support@route.ng</li>
              <li><strong>Website:</strong> https://route-ng.vercel.app</li>
              <li><strong>In-App:</strong> Use the Suggestions feature to contact support</li>
            </ul>
          </section>

          <section className="terms-section terms-summary">
            <h2>Summary of Key Points</h2>
            <table className="terms-table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Route.ng Responsibility</th>
                  <th>User & Manager Responsibility</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Correct amount to correct address</td>
                  <td>Full processing and payment</td>
                  <td>None beyond compliance</td>
                </tr>
                <tr>
                  <td>More than requested amount</td>
                  <td>None - card is non-tradeable</td>
                  <td>User & Manager bear full loss</td>
                </tr>
                <tr>
                  <td>Less than requested amount</td>
                  <td>None - assumed fraudulent</td>
                  <td>User & Manager bear full loss</td>
                </tr>
                <tr>
                  <td>Sent to wrong address</td>
                  <td>Best-effort recovery only</td>
                  <td>User & Manager bear full risk</td>
                </tr>
                <tr>
                  <td>Already redeemed code</td>
                  <td>No payment</td>
                  <td>User bears full loss</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="terms-section terms-acknowledgment">
            <h2>Acknowledgment</h2>
            <p>
              By creating an account and using Route.ng, you acknowledge that you have read and
              understood these Terms and Conditions, agree to be bound by all provisions herein,
              accept full responsibility for your transactions, and waive claims as outlined in
              the Disclaimers section.
            </p>
          </section>
        </div>

        <footer className="terms-footer">
          <button className="secondary-btn" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </footer>
      </div>
    </div>
  );
}
