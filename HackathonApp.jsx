import React, { useState } from 'react';

/**
 * HackathonApp Component
 * Updated Submission Portal with 3 Distinct Required Links:
 * 1. Public GitHub Repository Link
 * 2. Project Explanation Link (Google Drive)
 * 3. Working Model Video Link (YouTube / Drive)
 * 
 * Features:
 * - Managed `outputLink` state object with { githubLink, explanationLink, videoLink }
 * - Column-stacked inputs with custom dark/neon styling (cyan & purple accents)
 * - "Output transmitted successfully" confirmation screen with clickable anchor tags
 * - Webhook / Mock Firebase sync integration
 */

export default function HackathonApp({ 
  currentTeam = "Team CyberPulse", 
  currentUser = "alex.cyber", 
  selectedProblem = {
    id: 1,
    number: "01",
    title: "AI-POWERED SHORT VIDEO GENERATOR",
    domain: "AI, Multimedia, Cybersecurity and Intelligent Applications"
  },
  onWebhookSubmit
}) {
  // 1. Updated State Management: outputLink object with 3 properties
  const [outputLink, setOutputLink] = useState({
    githubLink: '',
    explanationLink: '',
    videoLink: ''
  });

  // Track submission state and submitted payload
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Handle individual input changes
  const handleInputChange = (field, value) => {
    setOutputLink(prev => ({
      ...prev,
      [field]: value
    }));
    if (errorMessage) setErrorMessage('');
  };

  // 2. Updated handleSubmitOutput function
  const handleSubmitOutput = async (e) => {
    e.preventDefault();

    // Validation for all three required links
    if (!outputLink.githubLink.trim() || !outputLink.explanationLink.trim() || !outputLink.videoLink.trim()) {
      setErrorMessage('Please provide all three required project links before submitting.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const submissionPayload = {
      teamName: currentTeam,
      problemTitle: selectedProblem ? selectedProblem.title : "General Submission",
      problemId: selectedProblem ? selectedProblem.id : null,
      submittedBy: currentUser,
      timestamp: new Date().toISOString(),
      displayTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      links: {
        githubLink: outputLink.githubLink.trim(),
        explanationLink: outputLink.explanationLink.trim(),
        videoLink: outputLink.videoLink.trim()
      }
    };

    try {
      // Mock Firebase / Webhook dispatch
      if (typeof onWebhookSubmit === 'function') {
        await onWebhookSubmit(submissionPayload);
      } else {
        // Simulated network delay
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Save submission state
      setSubmittedData(submissionPayload);
      setSubmissionSuccess(true);
    } catch (err) {
      setErrorMessage('Failed to transmit submission. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmission = () => {
    setSubmissionSuccess(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        
        {/* Card Header */}
        <div style={styles.cardHeader}>
          <div style={styles.badgeGroup}>
            <span style={styles.neonBadge}>SUBMISSION PORTAL</span>
            <span style={styles.teamBadge}>{currentTeam}</span>
          </div>

          <h2 style={styles.title}>
            {selectedProblem ? selectedProblem.title : "Hackathon Prototype Submission"}
          </h2>
          <p style={styles.subtitle}>
            Please submit your working repository, documentation, and video demonstration links below.
          </p>
        </div>

        {/* Success Screen: Output Transmitted Successfully */}
        {submissionSuccess && submittedData ? (
          <div style={styles.successContainer}>
            <div style={styles.successIconBox}>
              <span style={{ fontSize: '28px' }}>✓</span>
            </div>

            <h3 style={styles.successTitle}>Output Transmitted Successfully!</h3>
            <p style={styles.successSubtitle}>
              Recorded for <strong style={{ color: '#00f2fe' }}>{submittedData.teamName}</strong> at {submittedData.displayTime}.
            </p>

            {/* Clickable links review panel */}
            <div style={styles.submittedLinksCard}>
              <div style={styles.linksCardTitle}>VERIFY TRANSMITTED DELIVERABLES</div>

              {/* 1. GitHub Repo Link */}
              <div style={styles.linkRow}>
                <div style={styles.linkHeaderGroup}>
                  <span style={styles.linkIcon}>🐙</span>
                  <span style={styles.linkLabel}>Public GitHub Repository:</span>
                </div>
                <a 
                  href={submittedData.links.githubLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={styles.clickableLink}
                >
                  {submittedData.links.githubLink}
                  <span style={styles.arrowIcon}>↗</span>
                </a>
              </div>

              {/* 2. Google Drive Explanation Link */}
              <div style={styles.linkRow}>
                <div style={styles.linkHeaderGroup}>
                  <span style={styles.linkIcon}>📄</span>
                  <span style={styles.linkLabel}>Project Explanation (Google Drive):</span>
                </div>
                <a 
                  href={submittedData.links.explanationLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={styles.clickableLink}
                >
                  {submittedData.links.explanationLink}
                  <span style={styles.arrowIcon}>↗</span>
                </a>
              </div>

              {/* 3. Working Model Video Link */}
              <div style={styles.linkRow}>
                <div style={styles.linkHeaderGroup}>
                  <span style={styles.linkIcon}>🎥</span>
                  <span style={styles.linkLabel}>Working Model Video:</span>
                </div>
                <a 
                  href={submittedData.links.videoLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={styles.clickableLink}
                >
                  {submittedData.links.videoLink}
                  <span style={styles.arrowIcon}>↗</span>
                </a>
              </div>
            </div>

            <div style={styles.successActions}>
              <button 
                type="button" 
                onClick={handleEditSubmission}
                style={styles.btnSecondary}
              >
                Edit / Update Links
              </button>
            </div>
          </div>
        ) : (
          /* 3. Updated Form UI: Three Stacked Required Input Fields */
          <form onSubmit={handleSubmitOutput} style={styles.formColumn}>
            
            {errorMessage && (
              <div style={styles.errorAlert}>
                <span>⚠️ {errorMessage}</span>
              </div>
            )}

            {/* Field 1: Public GitHub Repository Link */}
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span>Public GitHub Repository Link <span style={{ color: '#ec4899' }}>*</span></span>
              </label>
              <input
                type="url"
                required
                placeholder="https://github.com/your-team/hackathon-prototype"
                value={outputLink.githubLink}
                onChange={(e) => handleInputChange('githubLink', e.target.value)}
                style={styles.input}
              />
              <span style={styles.helperText}>
                Ensure the repository is set to Public.
              </span>
            </div>

            {/* Field 2: Project Explanation Link (Google Drive) */}
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span>Project Explanation Link (Google Drive) <span style={{ color: '#ec4899' }}>*</span></span>
              </label>
              <input
                type="url"
                required
                placeholder="https://drive.google.com/drive/folders/..."
                value={outputLink.explanationLink}
                onChange={(e) => handleInputChange('explanationLink', e.target.value)}
                style={styles.input}
              />
              <span style={styles.helperText}>
                Submit a Google Drive link containing your Word doc, PDF, or presentation. Ensure access is set to 'Anyone with the link can view'.
              </span>
            </div>

            {/* Field 3: Working Model Video Link */}
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span>Working Model Video Link <span style={{ color: '#ec4899' }}>*</span></span>
              </label>
              <input
                type="url"
                required
                placeholder="https://youtube.com/watch?v=... or Google Drive link"
                value={outputLink.videoLink}
                onChange={(e) => handleInputChange('videoLink', e.target.value)}
                style={styles.input}
              />
              <span style={styles.helperText}>
                Video link (YouTube, Drive, etc.) demonstrating the working prototype.
              </span>
            </div>

            {/* Submit Button */}
            <div style={styles.footerRow}>
              <div style={styles.footerMeta}>
                Submitting as: <strong style={{ color: '#f8fafc' }}>{currentUser}</strong> ({currentTeam})
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  ...styles.btnPrimary,
                  opacity: isSubmitting ? 0.7 : 1,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? 'Transmitting Output...' : 'Transmit Output'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

// Neon-Accented (Purple / Cyan) Dark Mode Stylesheet
const styles = {
  container: {
    width: '100%',
    maxWidth: '860px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: '#f8fafc'
  },
  card: {
    backgroundColor: 'rgba(16, 23, 38, 0.85)',
    border: '1px solid rgba(0, 242, 254, 0.25)',
    borderRadius: '16px',
    padding: '36px',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(168, 85, 247, 0.15)',
    backdropFilter: 'blur(16px)',
    position: 'relative',
    overflow: 'hidden'
  },
  cardHeader: {
    marginBottom: '28px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '20px'
  },
  badgeGroup: {
    display: 'flex',
    gap: '10px',
    marginBottom: '12px'
  },
  neonBadge: {
    fontSize: '0.72rem',
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: '700',
    letterSpacing: '0.06em',
    color: '#00f2fe',
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    border: '1px solid rgba(0, 242, 254, 0.3)',
    padding: '4px 10px',
    borderRadius: '9999px',
    textTransform: 'uppercase'
  },
  teamBadge: {
    fontSize: '0.72rem',
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: '700',
    color: '#c084fc',
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    border: '1px solid rgba(168, 85, 247, 0.3)',
    padding: '4px 10px',
    borderRadius: '9999px'
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: '1.25',
    margin: '0 0 8px 0',
    letterSpacing: '-0.02em'
  },
  subtitle: {
    fontSize: '0.92rem',
    color: '#94a3b8',
    margin: 0,
    lineHeight: '1.5'
  },
  formColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '22px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '0.88rem',
    fontWeight: '600',
    color: '#e2e8f0',
    display: 'flex',
    justifyContent: 'space-between'
  },
  input: {
    backgroundColor: 'rgba(10, 15, 26, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    padding: '12px 16px',
    color: '#f8fafc',
    fontSize: '0.92rem',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)'
  },
  helperText: {
    fontSize: '0.76rem',
    color: '#94a3b8',
    lineHeight: '1.4'
  },
  footerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '12px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    flexWrap: 'wrap',
    gap: '12px'
  },
  footerMeta: {
    fontSize: '0.82rem',
    color: '#64748b'
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #00f2fe 0%, #a855f7 100%)',
    color: '#07090e',
    fontWeight: '700',
    fontSize: '0.92rem',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 28px',
    boxShadow: '0 4px 18px rgba(0, 242, 254, 0.35)',
    transition: 'transform 0.15s, box-shadow 0.15s'
  },
  btnSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    color: '#f8fafc',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    padding: '8px 18px',
    fontSize: '0.84rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  errorAlert: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    border: '1px solid rgba(244, 63, 94, 0.4)',
    color: '#fda4af',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '0.85rem'
  },
  successContainer: {
    textAlign: 'center',
    padding: '16px 0'
  },
  successIconBox: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '2px solid #10b981',
    color: '#10b981',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    boxShadow: '0 0 25px rgba(16, 185, 129, 0.3)'
  },
  successTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '6px'
  },
  successSubtitle: {
    fontSize: '0.9rem',
    color: '#94a3b8',
    marginBottom: '24px'
  },
  submittedLinksCard: {
    backgroundColor: 'rgba(10, 15, 26, 0.8)',
    border: '1px solid rgba(0, 242, 254, 0.2)',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginBottom: '24px'
  },
  linksCardTitle: {
    fontSize: '0.74rem',
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: '700',
    color: '#00f2fe',
    letterSpacing: '0.08em',
    marginBottom: '4px'
  },
  linkRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  linkHeaderGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  linkIcon: {
    fontSize: '0.9rem'
  },
  linkLabel: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#94a3b8'
  },
  clickableLink: {
    color: '#38bdf8',
    fontSize: '0.88rem',
    textDecoration: 'none',
    wordBreak: 'break-all',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: '6px',
    border: '1px solid rgba(56, 189, 248, 0.15)'
  },
  arrowIcon: {
    fontSize: '0.75rem',
    opacity: 0.8
  },
  successActions: {
    display: 'flex',
    justifyContent: 'center'
  }
};
