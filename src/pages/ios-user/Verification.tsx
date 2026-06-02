import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { uploadIDDocument, submitVerification } from '../../api/verification';
import type { IDType } from '../../types';

const ID_TYPES: { value: IDType; label: string }[] = [
  { value: 'nin', label: 'National Identification Number (NIN)' },
  { value: 'voters_card', label: "Voter's Card" },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'passport', label: 'International Passport' },
];

export default function Verification() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, iosUserProfile, refreshProfile } = useAuth();

  const [bvn, setBvn] = useState('');
  const [idType, setIdType] = useState<IDType>('nin');
  const [idNumber, setIdNumber] = useState('');
  const [idImage, setIdImage] = useState<{ file: File; preview: string } | null>(null);
  const [error, setError] = useState('');

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!iosUserProfile || !user || !idImage) {
        throw new Error('Missing required data');
      }

      // Upload ID document first
      const idImageUrl = await uploadIDDocument(user.id, idImage.file);

      // Submit verification
      return submitVerification(iosUserProfile.id, {
        bvn,
        id_type: idType,
        id_number: idNumber,
        id_image_url: idImageUrl,
      });
    },
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['ios-user-profile'] });
      navigate('/ios-user/dashboard');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Verification submission failed');
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setIdImage({
        file,
        preview: event.target?.result as string,
      });
      setError('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!bvn || bvn.length !== 11) {
      setError('Please enter a valid 11-digit BVN');
      return;
    }

    if (!idNumber.trim()) {
      setError('Please enter your ID number');
      return;
    }

    if (!idImage) {
      setError('Please upload a photo of your ID');
      return;
    }

    submitMutation.mutate();
  };

  if (!iosUserProfile) {
    return <div className="loading-container">Loading...</div>;
  }

  // Already verified or pending
  if (iosUserProfile.verification_status === 'verified') {
    return (
      <div className="verification-page">
        <div className="verification-success">
          <div className="success-icon">✓</div>
          <h2>You're Verified!</h2>
          <p>Your identity has been verified. You're eligible for company funding.</p>
          <button onClick={() => navigate('/ios-user/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (iosUserProfile.verification_status === 'pending') {
    return (
      <div className="verification-page">
        <div className="verification-pending">
          <div className="pending-icon">⏳</div>
          <h2>Verification Pending</h2>
          <p>Your verification documents are being reviewed. This usually takes 24-48 hours.</p>
          <p className="submitted-date">
            Submitted: {new Date(iosUserProfile.verification_submitted_at!).toLocaleDateString()}
          </p>
          <button onClick={() => navigate('/ios-user/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="verification-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/ios-user/dashboard')}>
          ← Back
        </button>
        <h1>Identity Verification</h1>
      </header>

      <div className="verification-intro">
        {iosUserProfile.verification_status === 'rejected' && (
          <div className="rejection-notice">
            <h3>Verification Rejected</h3>
            <p>Reason: {iosUserProfile.verification_rejection_reason || 'No reason provided'}</p>
            <p>Please correct the issues and resubmit.</p>
          </div>
        )}

        <div className="info-card">
          <h3>Why verify?</h3>
          <p>Verified users are eligible for company funding to purchase gift cards. This helps us ensure security and prevent fraud.</p>
          <ul>
            <li>Get funded by the company</li>
            <li>Higher transaction limits</li>
            <li>Priority support</li>
          </ul>
        </div>

        <div className="info-card warning">
          <h3>What you'll need:</h3>
          <ul>
            <li>Your 11-digit BVN (Bank Verification Number)</li>
            <li>A valid government-issued ID (NIN, Voter's Card, Driver's License, or Passport)</li>
            <li>A clear photo of your ID</li>
          </ul>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="verification-form">
        <div className="form-section">
          <h3>Bank Verification Number (BVN)</h3>
          <div className="form-group">
            <label htmlFor="bvn">BVN</label>
            <input
              id="bvn"
              type="text"
              value={bvn}
              onChange={(e) => setBvn(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="Enter your 11-digit BVN"
              maxLength={11}
              required
              disabled={submitMutation.isPending}
            />
            <p className="helper-text">
              Your BVN is a unique 11-digit number linked to your bank accounts.
              Dial *565*0# on your registered phone number to retrieve it.
            </p>
          </div>
        </div>

        <div className="form-section">
          <h3>Government-Issued ID</h3>
          <div className="form-group">
            <label htmlFor="idType">ID Type</label>
            <select
              id="idType"
              value={idType}
              onChange={(e) => setIdType(e.target.value as IDType)}
              required
              disabled={submitMutation.isPending}
            >
              {ID_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="idNumber">ID Number</label>
            <input
              id="idNumber"
              type="text"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder={idType === 'nin' ? 'Enter your 11-digit NIN' : 'Enter your ID number'}
              required
              disabled={submitMutation.isPending}
            />
          </div>

          <div className="form-group">
            <label>Upload ID Photo</label>
            {idImage ? (
              <div className="id-preview">
                <img src={idImage.preview} alt="ID Preview" />
                <button
                  type="button"
                  className="change-btn"
                  onClick={() => setIdImage(null)}
                  disabled={submitMutation.isPending}
                >
                  Change Photo
                </button>
              </div>
            ) : (
              <label className="upload-area">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  disabled={submitMutation.isPending}
                />
                <div className="upload-content">
                  <span className="upload-icon">📄</span>
                  <span className="upload-text">Upload ID Photo</span>
                  <span className="upload-hint">Clear photo showing all details</span>
                </div>
              </label>
            )}
            <p className="helper-text">
              Take a clear photo of your ID. Ensure all text is readable and the photo is not blurry.
            </p>
          </div>
        </div>

        {error && <p className="error-message">{error}</p>}

        <div className="form-actions">
          <button
            type="submit"
            className="submit-btn"
            disabled={submitMutation.isPending || !bvn || !idNumber || !idImage}
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit for Verification'}
          </button>
        </div>

        <p className="privacy-note">
          Your information is securely stored and only used for identity verification purposes.
          We do not share your personal data with third parties.
        </p>
      </form>
    </div>
  );
}
