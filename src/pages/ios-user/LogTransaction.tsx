import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getUserBanks } from '../../api/users';
import { getUserAppleIds } from '../../api/appleIds';
import { getSystemBanks } from '../../api/systemBanks';
import {
  createTransaction,
  updateTransaction,
  uploadProofImage,
  getIOSUserTransactions
} from '../../api/transactions';

interface ScreenshotEntry {
  id: string;
  file: File | null;
  preview: string;
  existingUrl?: string;
  receiptCount: number;
  cardAmount: number;
  totalAmount: number;
  bankId: string;
  appleIdId: string;
  recipientAddress: string;
  transactionId?: string;
}

export default function LogTransaction() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const { iosUserProfile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's banks
  const { data: banks = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['user-banks', iosUserProfile?.id],
    queryFn: () => iosUserProfile ? getUserBanks(iosUserProfile.id) : [],
    enabled: !!iosUserProfile,
  });

  // Fetch user's Apple IDs
  const { data: appleIds = [], isLoading: loadingAppleIds } = useQuery({
    queryKey: ['user-apple-ids', iosUserProfile?.user_id],
    queryFn: () => iosUserProfile ? getUserAppleIds(iosUserProfile.user_id) : [],
    enabled: !!iosUserProfile,
  });

  // Fetch active system banks for validation
  const { data: activeSystemBanks = [] } = useQuery({
    queryKey: ['active-system-banks'],
    queryFn: () => getSystemBanks(false), // Only active banks
  });

  // Get list of active bank names for validation
  const activeBankNames = useMemo(() =>
    activeSystemBanks.map(b => b.name.toLowerCase()),
    [activeSystemBanks]
  );

  // Check if a user bank is active in the system
  const isBankActive = (bankName: string) =>
    activeBankNames.includes(bankName.toLowerCase());

  // Fetch existing transaction if editing
  const { data: existingTransactions = [] } = useQuery({
    queryKey: ['ios-user-transactions', iosUserProfile?.id],
    queryFn: () => iosUserProfile
      ? getIOSUserTransactions(iosUserProfile.id, { status: 'pending_manager' })
      : [],
    enabled: !!iosUserProfile && !!editId,
  });

  const [screenshots, setScreenshots] = useState<ScreenshotEntry[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [selectedAppleIdId, setSelectedAppleIdId] = useState<string>('');
  const [currentFile, setCurrentFile] = useState<{ file: File; preview: string } | null>(null);
  const [receiptCount, setReceiptCount] = useState<number>(1);
  const [cardAmount, setCardAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [reportedTotalCards, setReportedTotalCards] = useState('');
  const [shortfallReason, setShortfallReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate expected transactions based on funding
  const expectedTransactions = useMemo(() => {
    if (!iosUserProfile?.is_funded || !iosUserProfile?.funding_amount) return 0;
    // Assuming standard card amount, or use the most common card amount entered
    const avgCardAmount = screenshots.length > 0
      ? screenshots.reduce((sum, s) => sum + s.cardAmount, 0) / screenshots.length
      : 5000; // Default N5,000 per card
    return Math.floor(iosUserProfile.funding_amount / avgCardAmount);
  }, [iosUserProfile, screenshots]);

  const totalReceipts = screenshots.reduce((sum, s) => sum + s.receiptCount, 0);
  const grandTotal = screenshots.reduce((sum, s) => sum + s.totalAmount, 0);
  const isShortfall = iosUserProfile?.is_funded && totalReceipts < expectedTransactions && totalReceipts > 0;

  // Set default bank when banks load
  useEffect(() => {
    if (banks.length > 0 && !selectedBankId) {
      const primaryBank = banks.find(b => b.is_primary) || banks[0];
      setSelectedBankId(primaryBank.id);
    }
  }, [banks, selectedBankId]);

  // Set default Apple ID when Apple IDs load
  useEffect(() => {
    if (appleIds.length > 0 && !selectedAppleIdId) {
      const primaryAppleId = appleIds.find(a => a.is_primary) || appleIds[0];
      setSelectedAppleIdId(primaryAppleId.id);
    }
  }, [appleIds, selectedAppleIdId]);

  // Load existing transaction for editing
  useEffect(() => {
    if (editId && existingTransactions.length > 0) {
      const txToEdit = existingTransactions.find(t => t.id === editId);
      if (txToEdit) {
        setScreenshots([{
          id: crypto.randomUUID(),
          file: null,
          preview: txToEdit.proof_image_url || '',
          existingUrl: txToEdit.proof_image_url,
          receiptCount: txToEdit.receipt_count,
          cardAmount: txToEdit.card_amount,
          totalAmount: txToEdit.gift_card_amount,
          bankId: txToEdit.bank_id || '',
          appleIdId: txToEdit.apple_id_id || '',
          recipientAddress: txToEdit.recipient_address || '',
          transactionId: txToEdit.id,
        }]);
        if (txToEdit.bank_id) {
          setSelectedBankId(txToEdit.bank_id);
        }
        if (txToEdit.shortfall_reason) {
          setShortfallReason(txToEdit.shortfall_reason);
        }
      }
    }
  }, [editId, existingTransactions]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload only image files');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCurrentFile({
        file,
        preview: event.target?.result as string,
      });
      setError('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const calculatedTotal = receiptCount * Number(cardAmount || 0);

  const addScreenshot = () => {
    if (!currentFile) {
      setError('Please upload a screenshot first');
      return;
    }

    if (!selectedBankId) {
      setError('Please select a bank');
      return;
    }

    // Check if selected bank is active
    const selectedBank = banks.find(b => b.id === selectedBankId);
    if (selectedBank && !isBankActive(selectedBank.bank_name)) {
      const activeBanksList = activeSystemBanks.map(b => b.name).join(', ');
      setError(
        `Your bank (${selectedBank.bank_name}) is not currently active. ` +
        `We do not support the rates offered by this bank. ` +
        `Please add one of our supported banks to your profile: ${activeBanksList}`
      );
      return;
    }

    const amount = Number(cardAmount);
    if (amount <= 0) {
      setError('Please enter the amount per card');
      return;
    }

    if (receiptCount < 1 || receiptCount > 5) {
      setError('Receipt count must be between 1 and 5');
      return;
    }

    if (!recipientAddress.trim()) {
      setError('Please enter the recipient address');
      return;
    }

    setScreenshots(prev => [...prev, {
      id: crypto.randomUUID(),
      file: currentFile.file,
      preview: currentFile.preview,
      receiptCount,
      cardAmount: amount,
      totalAmount: calculatedTotal,
      bankId: selectedBankId,
      appleIdId: selectedAppleIdId,
      recipientAddress: recipientAddress.trim(),
    }]);

    // Reset for next entry
    setCurrentFile(null);
    setReceiptCount(1);
    setCardAmount('');
    setRecipientAddress('');
    setError('');
  };

  const removeScreenshot = (id: string) => {
    setScreenshots(prev => prev.filter(s => s.id !== id));
  };

  // Group screenshots by bank
  const screenshotsByBank = screenshots.reduce((acc, s) => {
    if (!acc[s.bankId]) acc[s.bankId] = [];
    acc[s.bankId].push(s);
    return acc;
  }, {} as Record<string, ScreenshotEntry[]>);

  const getBankName = (bankId: string) => {
    const bank = banks.find(b => b.id === bankId);
    return bank ? bank.bank_name : 'Unknown Bank';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!iosUserProfile) {
      setError('Profile not loaded');
      return;
    }

    if (screenshots.length === 0) {
      setError('Please add at least one screenshot');
      return;
    }

    // Verify total cards count
    const reportedTotal = Number(reportedTotalCards);
    if (reportedTotal > 0 && reportedTotal !== totalReceipts) {
      setError(`Your reported total (${reportedTotal}) doesn't match the screenshots (${totalReceipts} cards). Please verify.`);
      return;
    }

    // Require shortfall reason if under expected
    if (isShortfall && !shortfallReason.trim()) {
      setError('Please explain why you completed fewer transactions than expected.');
      return;
    }

    setIsSubmitting(true);

    try {
      for (const screenshot of screenshots) {
        let imageUrl = screenshot.existingUrl || '';

        // Upload new image if there's a file
        if (screenshot.file) {
          imageUrl = await uploadProofImage(
            iosUserProfile.id,
            screenshot.file
          );
        }

        if (screenshot.transactionId) {
          // Update existing transaction
          await updateTransaction(screenshot.transactionId, {
            bank_id: screenshot.bankId,
            card_amount: screenshot.cardAmount,
            receipt_count: screenshot.receiptCount,
            gift_card_amount: screenshot.totalAmount,
            recipient_address: screenshot.recipientAddress,
            shortfall_reason: isShortfall ? shortfallReason : undefined,
            proof_image_url: imageUrl,
          });
        } else {
          // Create new transaction
          await createTransaction({
            ios_user_id: iosUserProfile.id,
            manager_id: iosUserProfile.manager_id,
            bank_id: screenshot.bankId,
            apple_id_id: screenshot.appleIdId || undefined,
            card_amount: screenshot.cardAmount,
            receipt_count: screenshot.receiptCount,
            gift_card_amount: screenshot.totalAmount,
            recipient_address: screenshot.recipientAddress,
            shortfall_reason: isShortfall ? shortfallReason : undefined,
            proof_image_url: imageUrl,
          });
        }
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['ios-user-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['ios-user-stats'] });

      navigate('/ios-user/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingBanks || loadingAppleIds) {
    return <div className="loading-container">Loading...</div>;
  }

  if (banks.length === 0) {
    return (
      <div className="setup-container">
        <h1>Route.ng</h1>
        <h2>Log Transactions</h2>
        <div className="warning-banner">
          <p>You need to add a bank account before logging transactions.</p>
        </div>
        <button onClick={() => navigate('/ios-user/dashboard')}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="setup-container log-transaction-page">
      <h1>Route.ng</h1>
      <h2>{editId ? 'Edit Transaction' : 'Log Transactions'}</h2>

      {/* Funding & Expected Transactions Info */}
      {iosUserProfile?.is_funded && (
        <div className="funding-info-box">
          <div className="funding-row">
            <span>Your Funding:</span>
            <strong>N{iosUserProfile.funding_amount.toLocaleString()}</strong>
          </div>
          <div className="funding-row">
            <span>Expected Transactions:</span>
            <strong>{expectedTransactions} cards</strong>
          </div>
          {totalReceipts > 0 && (
            <div className="funding-row">
              <span>Your Progress:</span>
              <strong className={isShortfall ? 'shortfall' : 'on-track'}>
                {totalReceipts} / {expectedTransactions} cards
              </strong>
            </div>
          )}
        </div>
      )}

      <div className="info-box">
        <p><strong>How it works:</strong></p>
        <ul>
          <li>Select the bank you used for purchases</li>
          <li>Screenshot your receipt <strong>list view</strong> (max 5 receipts per screenshot)</li>
          <li>Enter the amount per gift card, number of receipts, and recipient address</li>
          <li>Add multiple screenshots if needed (even from different banks)</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Apple ID Selection */}
        {appleIds.length > 0 && (
          <div className="form-group">
            <label>1. Select Apple ID Used</label>
            <select
              value={selectedAppleIdId}
              onChange={(e) => setSelectedAppleIdId(e.target.value)}
              disabled={isSubmitting}
            >
              {appleIds.map(appleId => (
                <option key={appleId.id} value={appleId.id}>
                  {appleId.apple_id}
                  {appleId.label ? ` (${appleId.label})` : ''}
                  {appleId.is_primary ? ' - Primary' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Bank Selection */}
        <div className="form-group">
          <label>{appleIds.length > 0 ? '2' : '1'}. Select Bank Used</label>
          <select
            value={selectedBankId}
            onChange={(e) => setSelectedBankId(e.target.value)}
            disabled={isSubmitting}
            className={selectedBankId && !isBankActive(banks.find(b => b.id === selectedBankId)?.bank_name || '') ? 'bank-inactive-warning' : ''}
          >
            {banks.map(bank => {
              const isActive = isBankActive(bank.bank_name);
              return (
                <option key={bank.id} value={bank.id}>
                  {bank.bank_name}
                  {bank.is_primary ? ' (Primary)' : ''}
                  {!isActive ? ' - NOT SUPPORTED' : ''}
                </option>
              );
            })}
          </select>
          {selectedBankId && !isBankActive(banks.find(b => b.id === selectedBankId)?.bank_name || '') && (
            <p className="helper-text warning">
              This bank is not currently supported. You won't be able to log transactions with it.
              Supported banks: {activeSystemBanks.map(b => b.name).join(', ')}
            </p>
          )}
        </div>

        {/* Screenshot Upload */}
        <div className="form-group">
          <label>{appleIds.length > 0 ? '3' : '2'}. Upload Screenshot of Receipt List</label>
          <div className="upload-area">
            {currentFile ? (
              <div className="preview-container">
                <img src={currentFile.preview} alt="Preview" className="upload-preview" />
                <button
                  type="button"
                  className="change-btn"
                  onClick={() => setCurrentFile(null)}
                >
                  Change Image
                </button>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  id="screenshot-input"
                  disabled={isSubmitting}
                />
                <label htmlFor="screenshot-input" className="upload-btn">
                  + Upload Screenshot
                </label>
              </>
            )}
          </div>
        </div>

        {currentFile && (
          <>
            {/* Receipt Count */}
            <div className="form-group">
              <label>3. How many receipts are in this screenshot?</label>
              <div className="receipt-count-selector">
                {[1, 2, 3, 4, 5].map(num => (
                  <button
                    key={num}
                    type="button"
                    className={`count-btn ${receiptCount === num ? 'active' : ''}`}
                    onClick={() => setReceiptCount(num)}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <p className="helper-text">Maximum 5 receipts per screenshot</p>
            </div>

            {/* Amount Per Card */}
            <div className="form-group">
              <label>4. Amount per gift card (N)</label>
              <input
                type="number"
                value={cardAmount}
                onChange={(e) => setCardAmount(e.target.value)}
                placeholder="e.g., 5000"
                min="1"
                required
              />
              <p className="helper-text">
                The value of each individual gift card
              </p>
            </div>

            {/* Recipient Address */}
            <div className="form-group">
              <label>5. Recipient Address (where gift cards were sent)</label>
              <input
                type="email"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="e.g., recipient@email.com"
                required
              />
              <p className="helper-text">
                The email address where these gift cards were delivered
              </p>
            </div>

            {/* Calculated Total */}
            {cardAmount && (
              <div className="calculated-total">
                <span>Calculated Total:</span>
                <strong>N{calculatedTotal.toLocaleString()}</strong>
                <span className="helper-text">({receiptCount} x N{Number(cardAmount).toLocaleString()})</span>
              </div>
            )}

            {/* Add Button */}
            <button
              type="button"
              className="add-btn"
              onClick={addScreenshot}
            >
              Add This Screenshot ({receiptCount} card{receiptCount > 1 ? 's' : ''}, N{calculatedTotal.toLocaleString()})
            </button>
          </>
        )}

        {/* Screenshots List Grouped by Bank */}
        {screenshots.length > 0 && (
          <div className="screenshots-list">
            <h3>Screenshots to Submit</h3>

            {Object.entries(screenshotsByBank).map(([bankId, bankScreenshots]) => (
              <div key={bankId} className="bank-group">
                <h4 className="bank-group-title">{getBankName(bankId)}</h4>
                {bankScreenshots.map((screenshot, index) => (
                  <div key={screenshot.id} className="screenshot-item">
                    <img
                      src={screenshot.preview || screenshot.existingUrl}
                      alt={`Screenshot ${index + 1}`}
                    />
                    <div className="screenshot-details">
                      <span className="screenshot-amount">N{screenshot.totalAmount.toLocaleString()}</span>
                      <span className="screenshot-count">
                        {screenshot.receiptCount} card{screenshot.receiptCount > 1 ? 's' : ''} @ N{screenshot.cardAmount.toLocaleString()}/each
                      </span>
                      <span className="screenshot-address">To: {screenshot.recipientAddress}</span>
                    </div>
                    <button
                      type="button"
                      className="remove-btn small"
                      onClick={() => removeScreenshot(screenshot.id)}
                      disabled={isSubmitting}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ))}

            <div className="total-summary">
              <div className="summary-row">
                <span>Total Gift Cards:</span>
                <strong>{totalReceipts}</strong>
              </div>
              <div className="summary-row">
                <span>Total Amount:</span>
                <strong>N{grandTotal.toLocaleString()}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Verification Input */}
        {screenshots.length > 0 && (
          <div className="form-group verification-group">
            <label>Verify: Total gift cards you transacted today</label>
            <input
              type="number"
              value={reportedTotalCards}
              onChange={(e) => setReportedTotalCards(e.target.value)}
              placeholder={`Should match ${totalReceipts} from screenshots`}
              min="1"
            />
            <p className="helper-text">
              This helps us verify your screenshots are complete
            </p>
          </div>
        )}

        {/* Shortfall Reason */}
        {isShortfall && (
          <div className="form-group shortfall-group">
            <label>
              You completed fewer transactions than expected ({totalReceipts} of {expectedTransactions}).
              Please explain:
            </label>
            <textarea
              value={shortfallReason}
              onChange={(e) => setShortfallReason(e.target.value)}
              placeholder="Explain why you couldn't complete the expected number of transactions..."
              rows={4}
              required
            />
          </div>
        )}

        {error && <p className="error-msg">{error}</p>}

        <div className="form-actions">
          <button
            type="submit"
            disabled={isSubmitting || screenshots.length === 0}
          >
            {isSubmitting
              ? 'Submitting...'
              : editId
                ? 'Update Transaction'
                : `Submit ${totalReceipts} Card${totalReceipts !== 1 ? 's' : ''} (N${grandTotal.toLocaleString()})`
            }
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => navigate('/ios-user/dashboard')}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
