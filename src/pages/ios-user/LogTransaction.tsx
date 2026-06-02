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

// Local storage keys for remembering user preferences
const STORAGE_KEYS = {
  lastBankId: 'route_last_bank_id',
  lastAppleIdId: 'route_last_apple_id',
  lastRecipient: 'route_last_recipient',
  lastCardAmount: 'route_last_card_amount',
  transactionDraft: 'route_transaction_draft',
  lastTransactionDate: 'route_last_transaction_date',
};

// Draft state that can be saved to localStorage (no File objects)
interface DraftState {
  transactionDate: string;
  cardCount: number;
  customCardCount: string;
  showCustomCount: boolean;
  cardAmount: string;
  bankChargeAmount: string;
  selectedBankId: string;
  selectedAppleIdId: string;
  recipientAddress: string;
  // Current file preview (not yet added to screenshots)
  currentFilePreview: string | null;
  // Screenshots without File objects (just previews for display)
  savedScreenshots: Array<{
    id: string;
    preview: string;
    transactionDate: string;
    cardCount: number;
    cardAmount: number;
    bankChargeAmount: number;
    totalAmount: number;
    bankId: string;
    appleIdId: string;
    recipientAddress: string;
  }>;
  savedAt: number;
}


interface ScreenshotEntry {
  id: string;
  file: File | null;
  preview: string;
  existingUrl?: string;
  transactionDate: string;
  cardCount: number;
  cardAmount: number;
  bankChargeAmount: number;
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

  // Data queries
  const { data: banks = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['user-banks', iosUserProfile?.id],
    queryFn: () => iosUserProfile ? getUserBanks(iosUserProfile.id) : [],
    enabled: !!iosUserProfile,
  });

  const { data: appleIds = [], isLoading: loadingAppleIds } = useQuery({
    queryKey: ['user-apple-ids', iosUserProfile?.user_id],
    queryFn: () => iosUserProfile ? getUserAppleIds(iosUserProfile.user_id) : [],
    enabled: !!iosUserProfile,
  });

  const { data: activeSystemBanks = [] } = useQuery({
    queryKey: ['active-system-banks'],
    queryFn: () => getSystemBanks(false),
  });

  const { data: existingTransactions = [] } = useQuery({
    queryKey: ['ios-user-transactions', iosUserProfile?.id],
    queryFn: () => iosUserProfile
      ? getIOSUserTransactions(iosUserProfile.id, { status: 'pending_manager' })
      : [],
    enabled: !!iosUserProfile && !!editId,
  });

  // Form state
  const [screenshots, setScreenshots] = useState<ScreenshotEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<{ file: File | null; preview: string } | null>(null);
  // Initialize with saved date if available (prevents loss when file picker opens on mobile)
  const [transactionDate, setTransactionDate] = useState<string>(() => {
    const savedDate = localStorage.getItem(STORAGE_KEYS.lastTransactionDate);
    const today = new Date().toISOString().split('T')[0];
    // Use saved date if it's not in the future
    if (savedDate && savedDate <= today) {
      return savedDate;
    }
    return today;
  });
  const [cardCount, setCardCount] = useState<number>(1);
  const [customCardCount, setCustomCardCount] = useState<string>('');
  const [showCustomCount, setShowCustomCount] = useState(false);
  const [cardAmount, setCardAmount] = useState<string>('');
  const [bankChargeAmount, setBankChargeAmount] = useState<string>('');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [selectedAppleIdId, setSelectedAppleIdId] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation helpers
  const activeBankNames = useMemo(() =>
    activeSystemBanks.map(b => b.name.toLowerCase()),
    [activeSystemBanks]
  );

  const isBankActive = (bankName: string) =>
    activeBankNames.includes(bankName.toLowerCase());

  const selectedBank = banks.find(b => b.id === selectedBankId);
  const isBankValid = selectedBank ? isBankActive(selectedBank.bank_name) : true;

  // Load saved preferences on mount
  useEffect(() => {
    const savedBankId = localStorage.getItem(STORAGE_KEYS.lastBankId);
    const savedAppleIdId = localStorage.getItem(STORAGE_KEYS.lastAppleIdId);
    const savedRecipient = localStorage.getItem(STORAGE_KEYS.lastRecipient);
    const savedAmount = localStorage.getItem(STORAGE_KEYS.lastCardAmount);

    if (savedRecipient) setRecipientAddress(savedRecipient);
    if (savedAmount) setCardAmount(savedAmount);
    if (savedBankId) setSelectedBankId(savedBankId);
    if (savedAppleIdId) setSelectedAppleIdId(savedAppleIdId);
  }, []);

  // Set default bank when banks load (if no saved preference)
  useEffect(() => {
    if (banks.length > 0 && !selectedBankId) {
      const primaryBank = banks.find(b => b.is_primary) || banks[0];
      setSelectedBankId(primaryBank.id);
    }
  }, [banks, selectedBankId]);

  // Set default Apple ID when loaded (if no saved preference)
  useEffect(() => {
    if (appleIds.length > 0 && !selectedAppleIdId) {
      const primaryAppleId = appleIds.find(a => a.is_primary) || appleIds[0];
      setSelectedAppleIdId(primaryAppleId.id);
    }
  }, [appleIds, selectedAppleIdId]);

  // Save transactionDate immediately (no debounce) to prevent loss when file picker opens
  useEffect(() => {
    if (!editId) {
      localStorage.setItem(STORAGE_KEYS.lastTransactionDate, transactionDate);
    }
  }, [transactionDate, editId]);

  // Load existing transaction for editing
  useEffect(() => {
    if (editId && existingTransactions.length > 0) {
      const txToEdit = existingTransactions.find(t => t.id === editId);
      if (txToEdit) {
        setTransactionDate(txToEdit.transaction_date);
        setScreenshots([{
          id: crypto.randomUUID(),
          file: null,
          preview: txToEdit.proof_image_url || '',
          existingUrl: txToEdit.proof_image_url,
          transactionDate: txToEdit.transaction_date,
          cardCount: txToEdit.receipt_count,
          cardAmount: txToEdit.card_amount,
          bankChargeAmount: txToEdit.bank_charge_amount || txToEdit.card_amount,
          totalAmount: txToEdit.gift_card_amount,
          bankId: txToEdit.bank_id || '',
          appleIdId: txToEdit.apple_id_id || '',
          recipientAddress: txToEdit.recipient_address || '',
          transactionId: txToEdit.id,
        }]);
        if (txToEdit.bank_id) setSelectedBankId(txToEdit.bank_id);
        if (txToEdit.apple_id_id) setSelectedAppleIdId(txToEdit.apple_id_id);
      }
    }
  }, [editId, existingTransactions]);

  // Restore draft state on mount (if not editing an existing transaction)
  useEffect(() => {
    if (editId) return; // Don't restore draft when editing

    try {
      const savedDraft = localStorage.getItem(STORAGE_KEYS.transactionDraft);
      if (savedDraft) {
        const draft: DraftState = JSON.parse(savedDraft);
        // Only restore if draft is less than 24 hours old
        const maxAge = 24 * 60 * 60 * 1000;
        if (Date.now() - draft.savedAt < maxAge) {
          setTransactionDate(draft.transactionDate);
          setCardCount(draft.cardCount);
          setCustomCardCount(draft.customCardCount);
          setShowCustomCount(draft.showCustomCount);
          setCardAmount(draft.cardAmount);
          setBankChargeAmount(draft.bankChargeAmount);
          if (draft.selectedBankId) setSelectedBankId(draft.selectedBankId);
          if (draft.selectedAppleIdId) setSelectedAppleIdId(draft.selectedAppleIdId);
          setRecipientAddress(draft.recipientAddress);
          // Restore current file preview (without File object)
          if (draft.currentFilePreview) {
            setCurrentFile({ file: null as unknown as File, preview: draft.currentFilePreview });
          }
          // Restore screenshots without File objects (previews only)
          if (draft.savedScreenshots.length > 0) {
            setScreenshots(draft.savedScreenshots.map(s => ({
              ...s,
              file: null, // File cannot be restored from localStorage
            })));
          }
        } else {
          // Draft expired, clear it
          localStorage.removeItem(STORAGE_KEYS.transactionDraft);
        }
      }
    } catch {
      // Ignore parsing errors
      localStorage.removeItem(STORAGE_KEYS.transactionDraft);
    }
  }, [editId]);

  // Save draft state whenever form changes (debounced)
  useEffect(() => {
    if (editId) return; // Don't save draft when editing

    const timeoutId = setTimeout(() => {
      // Only save if there's meaningful data to preserve
      const hasData = cardAmount || bankChargeAmount || screenshots.length > 0 ||
                      recipientAddress || customCardCount || cardCount > 1 || currentFile;

      if (hasData) {
        const draft: DraftState = {
          transactionDate,
          cardCount,
          customCardCount,
          showCustomCount,
          cardAmount,
          bankChargeAmount,
          selectedBankId,
          selectedAppleIdId,
          recipientAddress,
          currentFilePreview: currentFile?.preview || null,
          savedScreenshots: screenshots.map(s => ({
            id: s.id,
            preview: s.preview,
            transactionDate: s.transactionDate,
            cardCount: s.cardCount,
            cardAmount: s.cardAmount,
            bankChargeAmount: s.bankChargeAmount,
            totalAmount: s.totalAmount,
            bankId: s.bankId,
            appleIdId: s.appleIdId,
            recipientAddress: s.recipientAddress,
          })),
          savedAt: Date.now(),
        };
        localStorage.setItem(STORAGE_KEYS.transactionDraft, JSON.stringify(draft));
      }
    }, 500); // Debounce saves by 500ms

    return () => clearTimeout(timeoutId);
  }, [
    editId, transactionDate, cardCount, customCardCount, showCustomCount,
    cardAmount, bankChargeAmount, selectedBankId, selectedAppleIdId,
    recipientAddress, screenshots, currentFile
  ]);

  // Calculations
  const effectiveCardCount = showCustomCount ? Number(customCardCount) || 0 : cardCount;
  const effectiveBankCharge = Number(bankChargeAmount) || Number(cardAmount) || 0;
  const calculatedTotal = effectiveCardCount * effectiveBankCharge;
  const totalCards = screenshots.reduce((sum, s) => sum + s.cardCount, 0);
  const grandTotal = screenshots.reduce((sum, s) => sum + s.totalAmount, 0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
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

  const handleCardCountSelect = (count: number) => {
    if (count === -1) {
      setShowCustomCount(true);
      setCustomCardCount('');
    } else {
      setShowCustomCount(false);
      setCardCount(count);
    }
  };


  const addScreenshot = () => {
    if (!currentFile) {
      setError('Please upload a screenshot first');
      return;
    }

    if (!currentFile.file) {
      setError('Please re-select this photo (draft was restored but file needs to be re-uploaded)');
      return;
    }

    if (!selectedBankId) {
      setError('Please select a bank in the options below');
      setShowAdvanced(true);
      return;
    }

    if (!isBankValid) {
      setError(`${selectedBank?.bank_name} is not currently supported. Please select a different bank.`);
      setShowAdvanced(true);
      return;
    }

    const amount = Number(cardAmount);
    if (amount <= 0) {
      setError('Please enter the gift card amount');
      return;
    }

    if (effectiveCardCount < 1) {
      setError('Please select how many gift cards');
      return;
    }

    if (effectiveCardCount > 100) {
      setError('Maximum 100 cards per transaction. Please split into multiple entries.');
      return;
    }

    // Save preferences
    localStorage.setItem(STORAGE_KEYS.lastBankId, selectedBankId);
    localStorage.setItem(STORAGE_KEYS.lastAppleIdId, selectedAppleIdId);
    localStorage.setItem(STORAGE_KEYS.lastRecipient, recipientAddress);
    localStorage.setItem(STORAGE_KEYS.lastCardAmount, cardAmount);

    const chargeAmount = Number(bankChargeAmount) || amount;
    setScreenshots(prev => [...prev, {
      id: crypto.randomUUID(),
      file: currentFile.file,
      preview: currentFile.preview,
      transactionDate,
      cardCount: effectiveCardCount,
      cardAmount: amount,
      bankChargeAmount: chargeAmount,
      totalAmount: effectiveCardCount * chargeAmount,
      bankId: selectedBankId,
      appleIdId: selectedAppleIdId,
      recipientAddress: recipientAddress.trim(),
    }]);

    // Reset for next entry (keep amount and recipient as they're likely the same)
    setCurrentFile(null);
    setCardCount(1);
    setCustomCardCount('');
    setShowCustomCount(false);
    setError('');
  };

  const removeScreenshot = (id: string) => {
    setScreenshots(prev => prev.filter(s => s.id !== id));
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

    // Check if any restored screenshots need their photos re-selected
    const missingFiles = screenshots.filter(s => !s.file && !s.existingUrl);
    if (missingFiles.length > 0) {
      setError(`${missingFiles.length} screenshot(s) need to be re-selected (draft was restored). Please remove and re-add them.`);
      return;
    }

    setIsSubmitting(true);

    try {
      for (const screenshot of screenshots) {
        let imageUrl = screenshot.existingUrl || '';

        if (screenshot.file) {
          imageUrl = await uploadProofImage(iosUserProfile.id, screenshot.file);
        }

        if (screenshot.transactionId) {
          await updateTransaction(screenshot.transactionId, {
            bank_id: screenshot.bankId,
            apple_id_id: screenshot.appleIdId || undefined,
            card_amount: screenshot.cardAmount,
            bank_charge_amount: screenshot.bankChargeAmount,
            receipt_count: screenshot.cardCount,
            gift_card_amount: screenshot.totalAmount,
            recipient_address: screenshot.recipientAddress || undefined,
            proof_image_url: imageUrl,
          });
        } else {
          await createTransaction({
            ios_user_id: iosUserProfile.id,
            manager_id: iosUserProfile.manager_id,
            bank_id: screenshot.bankId,
            apple_id_id: screenshot.appleIdId || undefined,
            card_amount: screenshot.cardAmount,
            bank_charge_amount: screenshot.bankChargeAmount,
            receipt_count: screenshot.cardCount,
            gift_card_amount: screenshot.totalAmount,
            recipient_address: screenshot.recipientAddress || undefined,
            proof_image_url: imageUrl,
            transaction_date: screenshot.transactionDate,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['ios-user-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['ios-user-stats'] });
      // Clear draft and saved date on successful submission
      localStorage.removeItem(STORAGE_KEYS.transactionDraft);
      localStorage.removeItem(STORAGE_KEYS.lastTransactionDate);
      navigate('/ios-user/dashboard');
    } catch (err) {
      console.error('Transaction logging error:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Failed to log transaction. Please try again.');
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
        <h2>Add a Bank First</h2>
        <p>You need to add a bank account before logging transactions.</p>
        <button onClick={() => navigate('/ios-user/profile')}>
          Go to Profile
        </button>
      </div>
    );
  }

  const getBankName = (bankId: string) => banks.find(b => b.id === bankId)?.bank_name || 'Unknown';
  const getAppleIdLabel = (appleIdId: string) => {
    const appleId = appleIds.find(a => a.id === appleIdId);
    return appleId ? (appleId.label || appleId.apple_id) : '';
  };

  return (
    <div className="log-transaction-simplified">
      <header className="log-header">
        <button className="back-btn" onClick={() => navigate('/ios-user/dashboard')}>
          ← Back
        </button>
        <h1>{editId ? 'Edit Transaction' : 'Log Transaction'}</h1>
      </header>

      {/* Already Added Screenshots */}
      {screenshots.length > 0 && (
        <div className="added-screenshots">
          <div className="added-header">
            <span className="added-count">{totalCards} card{totalCards !== 1 ? 's' : ''} added</span>
            <span className="added-total">₦{grandTotal.toLocaleString()}</span>
          </div>
          <div className="added-list">
            {screenshots.map((s, i) => (
              <div key={s.id} className={`added-item ${!s.file && !s.existingUrl ? 'needs-reupload' : ''}`}>
                <img src={s.preview || s.existingUrl} alt={`Screenshot ${i + 1}`} />
                <div className="added-info">
                  <span className="added-cards">{s.cardCount} card{s.cardCount !== 1 ? 's'  : ''}</span>
                  <span className="added-amount">₦{s.totalAmount.toLocaleString()}</span>
                  {!s.file && !s.existingUrl && (
                    <span className="reupload-warning">Needs re-upload</span>
                  )}
                </div>
                <button
                  className="remove-btn"
                  onClick={() => removeScreenshot(s.id)}
                  disabled={isSubmitting}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="log-form">
        {/* Transaction Date */}
        <div className="date-section">
          <label className="section-label">
            Transaction Date
            <span className="label-hint">What date are you logging for?</span>
          </label>
          <input
            type="date"
            className="date-input"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            required
          />
        </div>

        {/* Screenshot Upload */}
        <div className="upload-section">
          {currentFile ? (
            <div className="preview-section">
              <img src={currentFile.preview} alt="Preview" className="screenshot-preview" />
              {!currentFile.file && (
                <p className="draft-warning">
                  Draft restored - please re-select this photo
                </p>
              )}
              <button type="button" className="change-photo-btn" onClick={() => setCurrentFile(null)}>
                {currentFile.file ? 'Change Photo' : 'Re-select Photo'}
              </button>
            </div>
          ) : (
            <label className="upload-area">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={isSubmitting}
              />
              <div className="upload-content">
                <span className="upload-icon">📷</span>
                <span className="upload-text">
                  {screenshots.length > 0 ? 'Add Another Screenshot' : 'Upload Screenshot'}
                </span>
                <span className="upload-hint">Tap to take photo or choose from gallery</span>
              </div>
            </label>
          )}
        </div>

        {/* Card Details (shown after photo) */}
        {currentFile && (
          <div className="card-details">
            {/* Card Count */}
            <div className="form-section">
              <label className="section-label">How many gift cards?</label>
              <div className="count-buttons">
                {[1, 2, 3, 4, 5].map(num => (
                  <button
                    key={num}
                    type="button"
                    className={`count-btn ${!showCustomCount && cardCount === num ? 'active' : ''}`}
                    onClick={() => handleCardCountSelect(num)}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  className={`count-btn more ${showCustomCount ? 'active' : ''}`}
                  onClick={() => handleCardCountSelect(-1)}
                >
                  6+
                </button>
              </div>
              {showCustomCount && (
                <input
                  type="number"
                  className="custom-count-input"
                  value={customCardCount}
                  onChange={(e) => setCustomCardCount(e.target.value)}
                  placeholder="Enter number"
                  min="1"
                  autoFocus
                />
              )}
            </div>

            {/* Gift Card Amount */}
            <div className="form-section">
              <label className="section-label">Gift card amount (each)</label>
              <input
                type="number"
                className="amount-input"
                value={cardAmount}
                onChange={(e) => setCardAmount(e.target.value)}
                placeholder="e.g. 5,000 - 15,000"
                min="1"
              />
            </div>

            {/* Bank Charge Amount */}
            <div className="form-section">
              <label className="section-label">
                Bank charge amount (each)
                <span className="label-hint">What did your bank charge per card?</span>
              </label>
              <input
                type="number"
                className="amount-input"
                value={bankChargeAmount}
                onChange={(e) => setBankChargeAmount(e.target.value)}
                placeholder={cardAmount ? `Usually around ₦${(Number(cardAmount) * 1.02).toFixed(0)}` : 'Enter bank charge'}
                min="1"
              />
            </div>

            {/* Recipient Email - Always visible */}
            <div className="form-section">
              <label className="section-label">
                Recipient email
                <span className="label-hint">Where the gift cards were sent</span>
              </label>
              <input
                type="email"
                className="amount-input"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="e.g. recipient@email.com"
              />
            </div>

            {/* Calculated Total */}
            {(cardAmount || bankChargeAmount) && effectiveCardCount > 0 && (
              <div className="total-preview">
                <span className="total-label">Total</span>
                <span className="total-value">₦{calculatedTotal.toLocaleString()}</span>
                <span className="total-breakdown">{effectiveCardCount} × ₦{effectiveBankCharge.toLocaleString()}</span>
              </div>
            )}

            {/* Advanced Options Toggle */}
            <button
              type="button"
              className="advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '▼' : '▶'} {showAdvanced ? 'Hide' : 'Show'} Options
              <span className="advanced-summary">
                {getBankName(selectedBankId)}
                {selectedAppleIdId && appleIds.length > 1 && ` • ${getAppleIdLabel(selectedAppleIdId)}`}
              </span>
            </button>

            {/* Advanced Options Panel */}
            {showAdvanced && (
              <div className="advanced-options">
                {/* Bank Selection */}
                <div className="form-section">
                  <label className="section-label">Bank Account</label>
                  <select
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className={!isBankValid ? 'invalid' : ''}
                  >
                    {banks.map(bank => (
                      <option key={bank.id} value={bank.id}>
                        {bank.bank_name}
                        {bank.is_primary ? ' (Primary)' : ''}
                        {!isBankActive(bank.bank_name) ? ' - NOT SUPPORTED' : ''}
                      </option>
                    ))}
                  </select>
                  {!isBankValid && (
                    <p className="field-error">
                      This bank is not currently supported.
                      Supported: {activeSystemBanks.map(b => b.name).join(', ')}
                    </p>
                  )}
                </div>

                {/* Apple ID Selection */}
                {appleIds.length > 0 && (
                  <div className="form-section">
                    <label className="section-label">Apple ID Used</label>
                    <select
                      value={selectedAppleIdId}
                      onChange={(e) => setSelectedAppleIdId(e.target.value)}
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
              </div>
            )}

            {/* Add Screenshot Button */}
            <button
              type="button"
              className="add-screenshot-btn"
              onClick={addScreenshot}
              disabled={!cardAmount || effectiveCardCount < 1}
            >
              {screenshots.length > 0
                ? `Add This (${effectiveCardCount} card${effectiveCardCount !== 1 ? 's' : ''})`
                : `Continue with ${effectiveCardCount} card${effectiveCardCount !== 1 ? 's' : ''}`
              }
            </button>
          </div>
        )}

        {error && <p className="error-message">{error}</p>}

        {/* Submit Section */}
        {screenshots.length > 0 && !currentFile && (
          <div className="submit-section">
            <div className="submit-summary">
              <span className="summary-cards">{totalCards} gift card{totalCards !== 1 ? 's' : ''}</span>
              <span className="summary-total">₦{grandTotal.toLocaleString()}</span>
            </div>
            <button
              type="submit"
              className="submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit for Review'}
            </button>
            <button
              type="button"
              className="add-more-btn"
              onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
            >
              + Add More Screenshots
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
