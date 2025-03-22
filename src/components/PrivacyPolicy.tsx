import React from 'react';
import { SEOHeaders } from './SEOHeaders';

export function PrivacyPolicy() {
  return (
    <>
      <SEOHeaders
        title="Privacy Policy"
        description="Privacy policy for Bropdf - Learn how we protect your data and respect your privacy"
      />
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-gray-600 mb-6">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Introduction</h2>
            <p className="text-gray-600">
              Welcome to Bropdf. We respect your privacy and are committed to protecting your personal data.
              This privacy policy explains how we collect, use, and safeguard your information when you use our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Information We Collect</h2>
            <p className="text-gray-600 mb-4">We collect information that you provide directly to us:</p>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>Account information (email address when you register)</li>
              <li>Files you upload for conversion or processing</li>
              <li>Usage data and preferences</li>
              <li>Technical information about your device and browser</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-600 mb-4">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-gray-600">
              <li>Provide and maintain our services</li>
              <li>Process your file conversions and enhancements</li>
              <li>Improve and personalize your experience</li>
              <li>Communicate with you about our services</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Data Security</h2>
            <p className="text-gray-600">
              We implement appropriate security measures to protect your data. Files uploaded for conversion
              are processed in memory and are not permanently stored on our servers. We use encryption
              for data transmission and secure cloud infrastructure for our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Your Rights</h2>
            <p className="text-gray-600 mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 text-gray-600">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to processing of your data</li>
              <li>Data portability</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Cookies</h2>
            <p className="text-gray-600">
              We use cookies and similar tracking technologies to enhance your experience.
              You can control cookies through your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Contact Us</h2>
            <p className="text-gray-600">
              If you have questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:privacy@bropdf.com" className="text-indigo-600 hover:text-indigo-800">
                privacy@bropdf.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </>
  );
}