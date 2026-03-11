import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { createIOSUserProfile, getVerifiedManagers } from '../../api/auth';

const AVAILABLE_BANKS = [
  'Zenith Bank',
  'UBA',
  'GTBank',
  'Chipper',
  'First Bank',
  'Access Bank',
  'Kuda',
  'Opay',
  'PalmPay',
  'Moniepoint',
];

interface BankEntry {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
}

export default function AddUserProfile() {
  const navigate = useNavigate();
  const { authUser, user, managerProfile, refreshProfile, setActiveRole } = useAuth();

  const [fullName, setFullName] = useState('');
  const [appleId, setAppleId] = useState(user?.email || '');
  const [banks, setBanks] = useState<BankEntry[]>([
    { id: crypto.randomUUID(), bank_name: '', account_number: '', account_name: '' }
  ]);
  const [managerId, setManagerId] = useState(managerProfile?.id || ''); // Default to self
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch verified managers (including self)
  const { data: managers = [], isLoading: loadingManagers } = useQuery({
    queryKey: ['verified-managers'],
    queryFn: getVerifiedManagers,
  });

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
      setError('Not authenticated');
      return;
    }

    if (!managerId) {
      setError('Please select a manager');
      return;
    }

    for (const bank of banks) {
      if (!bank.bank_name || !bank.account_number || !bank.account_name) {
        setError('Please fill in all bank details');
        return;
      }
    }

    setIsLoading(true);

    try {
      await createIOSUserProfile(
        authUser.id,
        fullName,
        appleId,
        managerId,
        banks.map(b => ({
          bank_name: b.bank_name,
          account_number: b.account_number,
          account_name: b.account_name,
        }))
      );

      await refreshProfile();
      setActiveRole('ios_user');
      navigate('/ios-user/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Include self in managers list if verified
  const allManagers = managerProfile?.status === 'verified' && !managers.find(m => m.id === managerProfile.id)
    ? [managerProfile, ...managers]
    : managers;

  return (
    <div className="setup-container">
      <h1>Route.ng</h1>
      <h2>Add iOS User Profile</h2>
      <p className="subtitle">Create an iOS user profile to participate in transactions</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="fullName">Full Name</label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
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
                  disabled={isLoading}
                >
                  <option value="">Select a bank</option>
                  {AVAILABLE_BANKS.map(bankName => (
                    <option key={bankName} value={bankName}>{bankName}</option>
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
          <label htmlFor="manager">Select Manager</label>
          <select
            id="manager"
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            required
            disabled={isLoading || loadingManagers}
          >
            <option value="">
              {loadingManagers ? 'Loading...' : 'Select a manager'}
            </option>
            {allManagers.map(manager => (
              <option key={manager.id} value={manager.id}>
                {manager.full_name} ({manager.team_name})
                {manager.id === managerProfile?.id ? ' (You)' : ''}
              </option>
            ))}
          </select>
          {allManagers.length === 0 && !loadingManagers && (
            <p className="helper-text">No verified managers available yet.</p>
          )}
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create iOS User Profile'}
        </button>

        <button
          type="button"
          className="secondary-btn"
          onClick={() => navigate('/manager/dashboard')}
          disabled={isLoading}
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
