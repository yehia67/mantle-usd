'use client';

import { useState, useEffect } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';

interface ComplianceFormData {
  residency: string;
  kyc_level: number;
  aml_passed: boolean;
  accredited_investor: boolean;
  exposure_musd: number;
  requested_amount: number;
  risk_score: number;
}

interface ComplianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolId: string;
  assetSymbol: string;
  swapAmount: string;
  onComplianceSuccess: (proof: ComplianceProof) => void;
}

interface ComplianceProof {
  seal: string;
  imageId: string;
  journalDigest: string;
  outcome: {
    allowed: boolean;
    reason: string;
    max_allocation: number;
  };
}

interface PoolRequirements {
  name: string;
  description: string;
  requirements: string[];
  min_kyc_level: number;
  max_risk_score: number;
  require_accreditation: boolean;
  allowed_residencies?: string[];
  banned_residencies?: string[];
}

const POOL_REQUIREMENTS: Record<string, PoolRequirements> = {
  gold: {
    name: 'Gold Pool',
    description: 'Trade tokenized gold with mUSD',
    requirements: [
      'Residency in US, CA, UK, DE, FR, SG, or AE',
      'KYC Level 2 or higher',
      'Risk score 4 or lower',
      'Passed AML screening',
      'Maximum single trade: 50,000 mUSD',
      'Maximum total exposure: 150,000 mUSD'
    ],
    min_kyc_level: 2,
    max_risk_score: 4,
    require_accreditation: false,
    allowed_residencies: ['US', 'CA', 'UK', 'DE', 'FR', 'SG', 'AE']
  },
  money_market: {
    name: 'Money Market Pool',
    description: 'Access money market instruments',
    requirements: [
      'Residency in US, CA, UK, DE, or FR',
      'KYC Level 3 or higher',
      'Risk score 3 or lower',
      'Accredited investor status required',
      'Passed AML screening',
      'Maximum single trade: 25,000 mUSD',
      'Maximum total exposure: 50,000 mUSD'
    ],
    min_kyc_level: 3,
    max_risk_score: 3,
    require_accreditation: true,
    allowed_residencies: ['US', 'CA', 'UK', 'DE', 'FR']
  },
  real_estate: {
    name: 'Real Estate Pool',
    description: 'Invest in tokenized real estate',
    requirements: [
      'Not from sanctioned countries (RU, KP, IR, SY)',
      'KYC Level 2 or higher',
      'Risk score 5 or lower',
      'Accredited investor status required',
      'Passed AML screening',
      'Maximum single trade: 200,000 mUSD',
      'Maximum total exposure: 500,000 mUSD'
    ],
    min_kyc_level: 2,
    max_risk_score: 5,
    require_accreditation: true,
    banned_residencies: ['RU', 'KP', 'IR', 'SY']
  }
};

export function ComplianceModal({ 
  isOpen, 
  onClose, 
  poolId, 
  assetSymbol,
  swapAmount,
  onComplianceSuccess 
}: ComplianceModalProps) {
  const { address } = useAppKitAccount();
  const [formData, setFormData] = useState<ComplianceFormData>({
    residency: '',
    kyc_level: 1,
    aml_passed: false,
    accredited_investor: false,
    exposure_musd: 0,
    requested_amount: 0,
    risk_score: 5
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const poolRequirements = POOL_REQUIREMENTS[poolId] || POOL_REQUIREMENTS.gold;

  useEffect(() => {
    if (swapAmount) {
      setFormData(prev => ({
        ...prev,
        requested_amount: parseFloat(swapAmount) || 0
      }));
    }
  }, [swapAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate form
      if (!formData.residency) {
        throw new Error('Please enter your residency country code');
      }

      if (formData.kyc_level < poolRequirements.min_kyc_level) {
        throw new Error(`This pool requires KYC Level ${poolRequirements.min_kyc_level} or higher`);
      }

      if (formData.risk_score > poolRequirements.max_risk_score) {
        throw new Error(`This pool requires risk score ${poolRequirements.max_risk_score} or lower`);
      }

      if (poolRequirements.require_accreditation && !formData.accredited_investor) {
        throw new Error('This pool requires accredited investor status');
      }

      if (!formData.aml_passed) {
        throw new Error('AML screening must be passed');
      }

      // Call Rust API
      const apiUrl = process.env.NEXT_PUBLIC_COMPLIANCE_API_URL || 'https://mantle-usd.onrender.com';
      const response = await fetch(`${apiUrl}/validate_user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: address,
          pool_id: poolId,
          residency: formData.residency.toUpperCase(),
          kyc_level: formData.kyc_level,
          aml_passed: formData.aml_passed,
          accredited_investor: formData.accredited_investor,
          exposure_musd: formData.exposure_musd,
          requested_amount: formData.requested_amount,
          risk_score: formData.risk_score
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'API request failed' }));
        throw new Error(errorData.message || `API error: ${response.status}`);
      }

      const result = await response.json();

      // Check if compliance was approved
      if (!result.outcome.allowed) {
        throw new Error(`Compliance check failed: ${result.outcome.reason}`);
      }

      // Extract proof data - convert arrays to bytes
      const sealBytes = result.proof?.seal 
        ? Array.isArray(result.proof.seal)
          ? `0x${result.proof.seal.map((b: number) => b.toString(16).padStart(2, '0')).join('')}`
          : `0x${result.proof.seal}`
        : '0x' + '00'.repeat(32);

      const journalBytes = result.proof?.journal
        ? Array.isArray(result.proof.journal)
          ? `0x${result.proof.journal.map((b: number) => b.toString(16).padStart(2, '0')).join('')}`
          : `0x${result.proof.journal}`
        : '0x' + '00'.repeat(32);

      // Parse imageId from U256 format
      let imageId = '0xcc8d9e54ea35adb5416485e372c5db1928bb4cc60b93e494ad227c50ef5b1082'; // @ToDo to be added on env variables
     
      const proof: ComplianceProof = {
        seal: sealBytes,
        imageId,
        journalDigest: journalBytes.slice(0, 66), // First 32 bytes (0x + 64 hex chars)
        outcome: result.outcome
      };

      onComplianceSuccess(proof);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Compliance Verification Required</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Privacy Notice */}
          <div className="privacy-notice">
            <div className="privacy-icon">🔒</div>
            <div className="privacy-text">
              <strong>Your Privacy is Protected</strong>
              <p>
                The information you provide is not shared publicly. We use zero-knowledge proofs 
                to verify compliance while preserving your privacy. Only the proof of compliance 
                is recorded on-chain, not your personal data.
              </p>
            </div>
          </div>

          {/* Pool Requirements */}
          <div className="pool-requirements">
            <h4>{poolRequirements.name} Requirements</h4>
            <p className="pool-description">{poolRequirements.description}</p>
            <ul>
              {poolRequirements.requirements.map((req, idx) => (
                <li key={idx}>{req}</li>
              ))}
            </ul>
          </div>

          {/* Compliance Form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                Country of Residency (2-letter code) *
                <span className="help-text">e.g., US, UK, CA, DE</span>
              </label>
              <input
                type="text"
                value={formData.residency}
                onChange={(e) => setFormData({ ...formData, residency: e.target.value.toUpperCase() })}
                placeholder="US"
                maxLength={2}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>
                KYC Level *
                <span className="help-text">Minimum required: {poolRequirements.min_kyc_level}</span>
              </label>
              <select
                value={formData.kyc_level}
                onChange={(e) => setFormData({ ...formData, kyc_level: parseInt(e.target.value) })}
                required
                className="form-input"
              >
                <option value={1}>Level 1 - Basic</option>
                <option value={2}>Level 2 - Standard</option>
                <option value={3}>Level 3 - Enhanced</option>
                <option value={4}>Level 4 - Premium</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                Risk Score *
                <span className="help-text">Maximum allowed: {poolRequirements.max_risk_score}</span>
              </label>
              <input
                type="number"
                value={formData.risk_score}
                onChange={(e) => setFormData({ ...formData, risk_score: parseInt(e.target.value) })}
                min={0}
                max={10}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>
                Current Exposure (mUSD)
                <span className="help-text">Your existing position in this pool</span>
              </label>
              <input
                type="number"
                value={formData.exposure_musd}
                onChange={(e) => setFormData({ ...formData, exposure_musd: parseFloat(e.target.value) || 0 })}
                min={0}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Requested Amount (mUSD)</label>
              <input
                type="number"
                value={formData.requested_amount}
                readOnly
                className="form-input"
                style={{ backgroundColor: '#f5f5f5' }}
              />
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.aml_passed}
                  onChange={(e) => setFormData({ ...formData, aml_passed: e.target.checked })}
                  required
                />
                <span>I confirm that I have passed AML screening *</span>
              </label>
            </div>

            {poolRequirements.require_accreditation && (
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.accredited_investor}
                    onChange={(e) => setFormData({ ...formData, accredited_investor: e.target.checked })}
                    required
                  />
                  <span>I am an accredited investor *</span>
                </label>
              </div>
            )}

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Verifying Compliance...' : 'Submit & Continue'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #111827;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 28px;
          color: #6b7280;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .modal-close:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .modal-body {
          padding: 24px;
        }

        .privacy-notice {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 24px;
          display: flex;
          gap: 16px;
        }

        .privacy-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        .privacy-text strong {
          display: block;
          font-size: 16px;
          margin-bottom: 8px;
        }

        .privacy-text p {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          opacity: 0.95;
        }

        .pool-requirements {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .pool-requirements h4 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }

        .pool-description {
          margin: 0 0 12px 0;
          color: #6b7280;
          font-size: 14px;
        }

        .pool-requirements ul {
          margin: 0;
          padding-left: 20px;
        }

        .pool-requirements li {
          margin: 6px 0;
          font-size: 14px;
          color: #374151;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-weight: 500;
          margin-bottom: 8px;
          color: #374151;
          font-size: 14px;
        }

        .help-text {
          display: block;
          font-weight: 400;
          color: #6b7280;
          font-size: 12px;
          margin-top: 4px;
        }

        .form-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          transition: all 0.2s;
        }

        .form-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .checkbox-group label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .checkbox-group input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .error-message {
          background: #fee2e2;
          color: #991b1b;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }

        .btn-primary,
        .btn-secondary {
          padding: 10px 20px;
          border-radius: 6px;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
}
