import React, { useState } from 'react';
import { TERMS_OF_USE, DEVELOPER_NAME } from '../constants';

interface TermsModalProps {
  onAccept: () => void;
  isReopened?: boolean;
}

const TermsModal: React.FC<TermsModalProps> = ({ onAccept, isReopened = false }) => {
  const [isChecked, setIsChecked] = useState(false);

  const renderTerms = () => {
    return TERMS_OF_USE.split(/(<bold>.*?<\/bold>)/g).map((part, index) => {
        if (part.startsWith('<bold>')) {
            return <strong key={index} className="font-bold text-primary-600 dark:text-primary-400 block mt-2">{part.replace(/<\/?bold>/g, '')}</strong>;
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Terms of Use</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Developed by {DEVELOPER_NAME}</p>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans">{renderTerms()}</div>
        </div>
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          {!isReopened && (
             <div className="flex items-center mb-4">
                <input
                id="terms-checkbox"
                type="checkbox"
                checked={isChecked}
                onChange={() => setIsChecked(!isChecked)}
                className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="terms-checkbox" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">
                I have read and agree to the Terms of Use.
                </label>
            </div>
          )}
          <button
            onClick={onAccept}
            disabled={!isReopened && !isChecked}
            className={`w-full px-4 py-2 text-white font-bold rounded-md transition-colors ${
              (!isReopened && !isChecked)
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
           {isReopened ? 'Close' : 'Agree and Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;
