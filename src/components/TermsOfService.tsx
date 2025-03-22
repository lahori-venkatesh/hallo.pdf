import React from 'react';
import { SEOHeaders } from './SEOHeaders';

export function TermsOfService() {
  return (
    <>
      <SEOHeaders
        title="Terms of Service"
        description="Terms of service and conditions for using Bropdf's document and image conversion tools"
      />
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-gray-600 mb-6">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-600">
              By accessing and using Bropdf, you accept and agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Description of Service</h2>
            <p className="text-gray-600">
              Bropdf provides online document and image conversion tools, including PDF creation,
              image compression, and document scanning services. These services are provided "as is"
              and may be updated or modified at any time.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. User Obligations</h2>
            <p className="text-gray-600 mb-4">You agree to:</p>
            <ul className="list-disc pl-6 text-gray-600">
              <li>Provide accurate information when creating an account</li>
              <li>Maintain the security of your account</li>
              <li>Use the services only for lawful purposes</li>
              <li>Not upload malicious files or content</li>
              <li>Respect intellectual property rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Intellectual Property</h2>
            <p className="text-gray-600">
              All content, features, and functionality of Bropdf are owned by us and protected by
              international copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Limitation of Liability</h2>
            <p className="text-gray-600">
              We are not liable for any damages arising from the use or inability to use our services.
              This includes direct, indirect, incidental, consequential, and punitive damages.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Service Modifications</h2>
            <p className="text-gray-600">
              We reserve the right to modify, suspend, or discontinue any part of our services
              at any time without notice. We are not liable to you or any third party for any
              modification, suspension, or discontinuation.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Governing Law</h2>
            <p className="text-gray-600">
              These terms are governed by and construed in accordance with applicable laws,
              without regard to its conflict of law principles.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">8. Contact</h2>
            <p className="text-gray-600">
              For questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:terms@bropdf.com" className="text-indigo-600 hover:text-indigo-800">
                terms@bropdf.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </>
  );
}