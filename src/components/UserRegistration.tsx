import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { createIOSUserProfile, getManagerByReferralCode } from '../api/auth';
import { getSystemBanks } from '../api/systemBanks';
import { getHouseAccountManager } from '../api/managers';

interface LocationState {
  email: string;
  username: string;
  password: string;
}

interface BankEntry {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
}

export default function UserRegistration() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { authUser, refreshProfile, setIsRegistering } = useAuth();

  const state = location.state as LocationState | null;
  const urlReferralCode = searchParams.get('ref') || searchParams.get('invite') || '';

  const [name, setName] = useState('');
  const [appleId, setAppleId] = useState(state?.email || '');
  const [banks, setBanks] = useState<BankEntry[]>([
    { id: crypto.randomUUID(), bank_name: '', account_number: '', account_name: '' }
  ]);
  const [referralCode, setReferralCode] = useState(urlReferralCode);
  const [referralStatus, setReferralStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [validatedManagerId, setValidatedManagerId] = useState<string | null>(null);
  const [validatedManagerName, setValidatedManagerName] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch house account manager
  const { data: houseAccountManager } = useQuery({
    queryKey: ['house-account-manager'],
    queryFn: getHouseAccountManager,
  });

  // Fetch ALL banks from system (including inactive - users can register with any bank)
  const { data: availableBanks = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['system-banks-all'],
    queryFn: () => getSystemBanks(true),
  });

  // Validate referral code from URL on mount
  useEffect(() => {
    if (urlReferralCode) {
      validateReferralCode(urlReferralCode);
    }
  }, [urlReferralCode]);

  useEffect(() => {
    if (!state?.email && !authUser) {
      navigate('/register/user');
    }
  }, [state, authUser, navigate]);

  // Validate referral code when it changes (with debounce)
  useEffect(() => {
    if (!referralCode.trim()) {
      setReferralStatus('idle');
      setValidatedManagerId(null);
      setValidatedManagerName(null);
      return;
    }

    const timer = setTimeout(() => {
      validateReferralCode(referralCode);
    }, 500);

    return () => clearTimeout(timer);
  }, [referralCode]);

  const validateReferralCode = async (code: string) => {
    if (!code.trim()) return;

    const manager = await getManagerByReferralCode(code.trim());
    if (manager) {
      // Valid code - could be a regular manager or house account
      setReferralStatus('valid');
      setValidatedManagerId(manager.id);
      setValidatedManagerName(manager.is_house_account ? 'Route.ng Direct (Independent)' : manager.full_name);
    } else {
      setReferralStatus('invalid');
      setValidatedManagerId(null);
      setValidatedManagerName(null);
    }
  };

  const addBank = () => {
    setBanks([...banks, {
      id: crypto.randomUUID(),
      bank_name: '',
      account_number: '',
      account_name: ''
    }]);
  };

  const removeBank = (id: string) => {
    if (banks.length > 1) {
      setBanks(banks.filter(b => b.id !== id));
    }
  };

  const updateBank = (id: string, field: keyof Omit<BankEntry, 'id'>, value: string) => {
    setBanks(banks.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!authUser) {
      setError('Please complete the registration first');
      return;
    }

    // Validate banks
    for (const bank of banks) {
      if (!bank.bank_name || !bank.account_number || !bank.account_name) {
        setError('Please fill in all bank details');
        return;
      }
    }

    // Determine manager ID: use validated manager or house account
    let finalManagerId: string;

    if (referralCode.trim() && referralStatus === 'valid' && validatedManagerId) {
      finalManagerId = validatedManagerId;
    } else if (referralCode.trim() && referralStatus === 'invalid') {
      setError('Invalid referral code. Please check and try again, or leave it empty to join independently.');
      return;
    } else if (houseAccountManager) {
      // No referral code - assign to house account
      finalManagerId = houseAccountManager.id;
    } else {
      // House account not set up - this is a system configuration issue
      setError('System not configured. Please contact support or try again later.');
      console.error('House account manager not found. Run database migration to create it.');
      return;
    }

    setIsLoading(true);

    try {
      await createIOSUserProfile(
        authUser.id,
        name,
        appleId,
        finalManagerId,
        banks.map(b => ({
          bank_name: b.bank_name,
          account_number: b.account_number,
          account_name: b.account_name,
        }))
      );

      await refreshProfile();
      setIsRegistering(false);
      navigate('/registration-success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (!state && !authUser) return null;

  return (
    <div className="setup-container">
      <h1>Route.ng</h1>
      <h2>Complete your profile</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your full name"
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="appleId">Apple ID Email</label>
          <input
            id="appleId"
            type="email"
            value={appleId}
            onChange={(e) => setAppleId(e.target.value)}
            placeholder="your@icloud.com"
            required
            disabled={isLoading}
          />
        </div>

        <div className="banks-section">
          <h3>Bank Accounts</h3>
          {banks.map((bank, index) => (
            <div key={bank.id} className="bank-entry">
              <div className="form-group">
                <label>Bank {index + 1}</label>
                <select
                  value={bank.bank_name}
                  onChange={(e) => updateBank(bank.id, 'bank_name', e.target.value)}
                  required
                  disabled={isLoading || loadingBanks}
                >
                  <option value="">{loadingBanks ? 'Loading banks...' : 'Select a bank'}</option>
                  {availableBanks.map(systemBank => (
                    <option key={systemBank.id} value={systemBank.name}>{systemBank.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Account Number</label>
                <input
                  type="text"
                  value={bank.account_number}
                  onChange={(e) => updateBank(bank.id, 'account_number', e.target.value)}
                  placeholder="Account number"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="form-group">
                <label>Account Name</label>
                <input
                  type="text"
                  value={bank.account_name}
                  onChange={(e) => updateBank(bank.id, 'account_name', e.target.value)}
                  placeholder="Account holder name"
                  required
                  disabled={isLoading}
                />
              </div>
              {banks.length > 1 && (
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeBank(bank.id)}
                  disabled={isLoading}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="add-btn"
            onClick={addBank}
            disabled={isLoading}
          >
            + Add Another Bank
          </button>
        </div>

        {/* Simple Referral Code Input */}
        <div className="form-group">
          <label htmlFor="referralCode">Referral Code</label>
          <input
            id="referralCode"
            type="text"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder="Op7i0NAL"
            disabled={isLoading}
            className={referralStatus === 'valid' ? 'input-valid' : referralStatus === 'invalid' ? 'input-invalid' : ''}
          />
          {referralStatus === 'valid' && validatedManagerName && (
            <p className="helper-text success">Joining {validatedManagerName}'s team</p>
          )}
          {referralStatus === 'invalid' && (
            <p className="helper-text error">Invalid referral code</p>
          )}
          {referralStatus === 'idle' && (
            <p className="helper-text">
              This is the code at the end of your referral link (after ?ref=). Leave empty to join as an independent partner.
            </p>
          )}
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating profile...' : 'Complete Registration'}
        </button>
      </form>
    </div>
  );
}
