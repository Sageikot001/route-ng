import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getManagerInvites, createInvite } from '../../api/managers';

export default function ManagerInvites() {
  const { managerProfile } = useAuth();
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const referralLink = managerProfile?.referral_code
    ? `${window.location.origin}/register/user?ref=${managerProfile.referral_code}`
    : '';

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ['manager-invites', managerProfile?.id],
    queryFn: () => managerProfile ? getManagerInvites(managerProfile.id) : [],
    enabled: !!managerProfile,
  });

  const sendInviteMutation = useMutation({
    mutationFn: (email: string) => {
      if (!managerProfile) throw new Error('No manager profile');
      return createInvite(managerProfile.id, email);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-invites'] });
      setInviteEmail('');
      setInviteError('');
    },
    onError: (error) => {
      setInviteError(error instanceof Error ? error.message : 'Failed to send invite');
    },
  });

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail) {
      sendInviteMutation.mutate(inviteEmail);
    }
  };

  const isPending = managerProfile?.status === 'pending';

  const pendingInvites = invites.filter(i => i.status === 'pending');
  const acceptedInvites = invites.filter(i => i.status === 'accepted');

  return (
    <div className="manager-page">
      <header className="page-header">
        <h1>Invites</h1>
        <p>Grow your team by inviting new members</p>
      </header>

      {isPending && (
        <div className="warning-banner">
          <p>Your manager account is pending verification. Invite features will be enabled once verified.</p>
        </div>
      )}

      {!isPending && (
        <>
          {/* Referral Code Section */}
          <div className="invite-method-card">
            <h3>Share Your Referral Code</h3>
            <p className="helper-text">Anyone who signs up with this code will automatically join your team</p>
            <div className="referral-code-display">
              <span className="code">{managerProfile?.referral_code}</span>
              <button className="copy-btn" onClick={copyReferralLink}>
                {copiedCode ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* Email Invite Section */}
          <div className="invite-method-card">
            <h3>Send Email Invite</h3>
            <p className="helper-text">Send a direct invitation to someone's email</p>
            <form onSubmit={handleSendInvite} className="invite-form">
              <div className="input-group">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Enter email address"
                  disabled={sendInviteMutation.isPending}
                />
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={!inviteEmail || sendInviteMutation.isPending}
                >
                  {sendInviteMutation.isPending ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
              {inviteError && <p className="error-msg">{inviteError}</p>}
            </form>
          </div>
        </>
      )}

      {/* Invite History */}
      <div className="invites-section">
        <h3>Sent Invites</h3>

        {isLoading ? (
          <div className="loading">Loading invites...</div>
        ) : invites.length === 0 ? (
          <div className="empty-state">
            <p>No invites sent yet.</p>
            {!isPending && <p>Use the form above to invite new team members.</p>}
          </div>
        ) : (
          <>
            {pendingInvites.length > 0 && (
              <div className="invite-group">
                <h4>Pending ({pendingInvites.length})</h4>
                <div className="invites-list">
                  {pendingInvites.map(invite => (
                    <div key={invite.id} className="invite-card pending">
                      <div className="invite-info">
                        <span className="invite-email">{invite.email}</span>
                        {invite.email_sent_at && (
                          <span className="invite-date">
                            Sent {new Date(invite.email_sent_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <span className="status-badge pending">
                        {invite.email_sent_at ? 'Awaiting' : 'Sending...'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {acceptedInvites.length > 0 && (
              <div className="invite-group">
                <h4>Accepted ({acceptedInvites.length})</h4>
                <div className="invites-list">
                  {acceptedInvites.map(invite => (
                    <div key={invite.id} className="invite-card accepted">
                      <div className="invite-info">
                        <span className="invite-email">{invite.email}</span>
                        {invite.accepted_at && (
                          <span className="invite-date">
                            Accepted {new Date(invite.accepted_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <span className="status-badge accepted">Joined</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
