// Privacy notice gate.
//
// Before a temporary user can create their first Document, display a privacy notice.
// The notice clearly states: data is temporary, retention policy, and that no
// account is required to proceed.
// User must explicitly accept (click "I Understand") before any Document is created.

import { acceptPrivacy } from "@/lib/actions/privacy";

export default function StartPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Welcome to Conditions Translator
        </h1>
        
        <div className="space-y-4 text-gray-700 mb-8">
          <p>
            Before you begin, please understand how we handle your data:
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">
              Privacy Notice
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Your data is temporary:</strong> Documents expire after 24 hours and are automatically deleted.
              </li>
              <li>
                <strong>No account required:</strong> You can upload and translate documents without creating an account.
              </li>
              <li>
                <strong>Privacy-first:</strong> Your documents are never shared or used for training purposes.
              </li>
              <li>
                <strong>AI is document-grounded:</strong> The AI only answers from your uploaded document content.
              </li>
              <li>
                <strong>Chat is temporary:</strong> Conversation history is not permanently stored.
              </li>
            </ul>
          </div>
          
          <p>
            By clicking "I Understand", you acknowledge that your data will be
            temporary and automatically deleted after 24 hours. You can choose to
            create an account later if you want to save your work permanently.
          </p>
        </div>
        
        <form action={acceptPrivacy}>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            I Understand
          </button>
        </form>
      </div>
    </div>
  );
}