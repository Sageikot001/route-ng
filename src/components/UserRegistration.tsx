import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { createIOSUserProfile, getVerifiedManagers, getManagerByReferralCode } from '../api/auth';
import { getSystemBanks } from '../api/systemBanks';

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
  const referralCode = searchParams.get('ref') || searchParams.get('invite') || '';

  const [name, setName] = useState('');
  const [appleId, setAppleId] = useState(state?.email || '');
  const [banks, setBanks] = useState<BankEntry[]>([
    { id: crypto.randomUUID(), bank_name: '', account_number: '', account_name: '' }
  ]);
  const [managerId, setManagerId] = useState('');
  const [referredManager, setReferredManager] = useState<{ id: string; full_name: string; team_name: string } | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch verified managers
  const { data: managers = [], isLoading: loadingManagers } = useQuery({
    queryKey: ['verified-managers'],
    queryFn: getVerifiedManagers,
  });

  // Fetch available banks from system
  const { data: availableBanks = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['system-banks'],
    queryFn: () => getSystemBanks(false), // Only active banks
  });

  // Look up manager by referral code
  useEffect(() => {
    if (referralCode) {
      getManagerByReferralCode(referralCode).then(manager => {
        if (manager) {
          setReferredManager({ id: manager.id, full_name: manager.full_name, team_name: manager.team_name });
          setManagerId(manager.id);
        }
      });
    }
  }, [referralCode]);

  useEffect(() => {
    // Redirect to step 1 if no state data and not authenticated
    if (!state?.email && !authUser) {
      navigate('/register/user');
    }
  }, [state, authUser, navigate]);

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

    if (!managerId) {
      setError('Please select a manager');
      return;
    }

    // Validate banks
    for (const bank of banks) {
      if (!bank.bank_name || !bank.account_number || !bank.account_name) {
        setError('Please fill in all bank details');
        return;
      }
    }

    setIsLoading(true);

    try {
      // Create iOS user profile in database
      await createIOSUserProfile(
        authUser.id,
        name,
        appleId,
        managerId,
        banks.map(b => ({
          bank_name: b.bank_name,
          account_number: b.account_number,
          account_name: b.account_name,
        }))
      );

      // Refresh the auth context to get the new profile
      await refreshProfile();

      // Clear the registering flag now that registration is complete
      setIsRegistering(false);

      // Navigate to success page
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

        <div className="form-group">
          <label htmlFor="manager">Your Manager</label>
          {referredManager ? (
            <div className="referred-manager-box">
              <div className="referred-manager-info">
                <strong>{referredManager.full_name}</strong>
                <span>{referredManager.team_name}</span>
              </div>
              <button
                type="button"
                className="change-manager-btn"
                onClick={() => {
                  setReferredManager(null);
                  setManagerId('');
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <select
                id="manager"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                required
                disabled={isLoading || loadingManagers}
              >
                <option value="">
                  {loadingManagers ? 'Loading managers...' : 'Select your manager'}
                </option>
                {managers.map(manager => (
                  <option key={manager.id} value={manager.id}>
                    {manager.full_name} ({manager.team_name})
                  </option>
                ))}
              </select>
              {managers.length === 0 && !loadingManagers && (
                <p className="helper-text">No verified managers available yet. Please contact support.</p>
              )}
            </>
          )}
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button type="submit" disabled={isLoading || loadingManagers}>
          {isLoading ? 'Creating profile...' : 'Complete Registration'}
        </button>
      </form>
    </div>
  );
}
