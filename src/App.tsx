import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { FileUp, Image, FileText, FilePlus, FileDown, Split, FileCode2, Search, Minimize2, Menu, X, Camera, Mail, Lock, Eye, EyeOff, LogOut, Images } from 'lucide-react';
import { ImageTools } from './components/ImageTools';
import { PDFTools } from './components/PDFTools';
import { HTMLToPDF } from './components/HTMLToPDF';
import { DigitalImageEnhancer } from './components/DigitalImageEnhancer';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { TermsOfService } from './components/TermsOfService';
import { Contact } from './components/Contact';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SEOHeaders } from './components/SEOHeaders';
import { StickyBottomAd } from './components/AdComponent';

function FeatureCard({ icon: Icon, title, description, to }: { icon: React.ElementType, title: string, description: string, to: string }) {
  return (
    <Link to={to} className="block">
      <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
        <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-lg mb-4">
          <Icon className="w-6 h-6 text-indigo-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </div>
    </Link>
  );
}

function PasswordInput({ 
  id, 
  value, 
  onChange, 
  placeholder, 
  required = true,
  error = false,
}: { 
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  required?: boolean;
  error?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
        type={showPassword ? "text" : "password"}
        id={id}
        value={value}
        onChange={onChange}
        className={`pl-10 pr-10 w-full rounded-lg shadow-sm focus:ring-indigo-500 ${
          error 
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
            : 'border-gray-300 focus:border-indigo-500'
        }`}
        placeholder={placeholder}
        required={required}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}

function AuthModal({ isOpen, onClose, mode }: { isOpen: boolean, onClose: () => void, mode: 'login' | 'signup' | 'forgot-password' }) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'forgot-password') {
        const { error: resetError } = await resetPassword(email);
        if (resetError) throw resetError;
        setResetEmailSent(true);
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) throw signUpError;
        onClose();
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) throw signInError;
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleModeSwitch = (newMode: 'login' | 'signup' | 'forgot-password') => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setResetEmailSent(false);
    setError(null);
    onClose();
    setTimeout(() => {
      setAuthMode(newMode);
      setAuthModalOpen(true);
    }, 100);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {mode === 'login' ? 'Log In' : mode === 'signup' ? 'Sign Up' : 'Reset Password'}
        </h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        
        {mode === 'forgot-password' && resetEmailSent ? (
          <div className="text-center">
            <div className="mb-4 text-green-600">
              Password reset instructions have been sent to your email.
            </div>
            <button
              onClick={() => handleModeSwitch('login')}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Return to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>
            
            {mode !== 'forgot-password' && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  error={error?.toLowerCase().includes('password')}
                />
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  error={password !== confirmPassword}
                />
              </div>
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleModeSwitch('forgot-password')}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : mode === 'signup' ? 'Sign Up' : 'Reset Password'}
            </button>

            <div className="text-center text-sm">
              {mode === 'login' ? (
                <p>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('signup')}
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Sign up
                  </button>
                </p>
              ) : mode === 'signup' ? (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('login')}
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Log in
                  </button>
                </p>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function StepCard({ number, title, description }: { number: number, title: string, description: string }) {
  return (
    <div className="flex items-start space-x-4">
      <div className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
        {number}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </div>
    </div>
  );
}

function HomePage() {
  return (
    <>
      <SEOHeaders 
        title="Free Online PDF & Image Tools | Convert, Compress, Merge & Enhance Files"
        description="All-in-One Online PDF & Image Processing Tool | Convert, Compress, Merge & Enhance for Free"
        keywords={[
          'pdf converter online',
          'image compression tool',
          'photo enhancer free',
          'merge pdf files',
          'compress images online',
          'jpg to pdf converter',
          'image resizer online',
          'convert jpg to png online',
          'png to jpg converter',
          'image upscaling tool',
          'crop images online free',
          'ai image enhancement'
        ]}
      />
      
      {/* Hero Section */}
      <section className="relative bg-indigo-700 py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative z-10 text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-6">
              Effortless Document & Image Conversion
            </h1>
            <p className="text-lg sm:text-xl text-indigo-100 mb-6 sm:mb-8">
              Transform your documents and images with just a few clicks
            </p>
            <Link
              to="/image-tools"
              className="inline-block bg-white text-indigo-600 px-6 sm:px-8 py-2 sm:py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-colors duration-300"
            >
              Get Started
            </Link>
          </div>
        </div>
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497493292307-31c376b6e479?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10"></div>
      </section>

      {/* Features Grid */}
      <section className="py-12 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-8 sm:mb-12">
            Everything You Need in One Place
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <FeatureCard
              icon={Image}
              title="Image size reduce"
              description="Quickly compress and convert images without losing quality."
              to="/image-tools"
            />
            <FeatureCard
              icon={FileUp}
              title="Image to PDF"
              description="Convert your images into professional PDF documents"
              to="/pdf-tools"
            />
            <FeatureCard
              icon={FilePlus}
              title="Merge PDFs"
              description="Combine multiple PDF files into a single document"
              to="/pdf-tools?tab=merge"
            />
            <FeatureCard
              icon={Split}
              title="Split PDF"
              description="Divide large PDF files into smaller sections"
              to="/pdf-tools?tab=split"
            />
            <FeatureCard
              icon={FileCode2}
              title="HTML to PDF"
              description="Convert web pages into PDF documents"
              to="/html-to-pdf"
            />
            <FeatureCard
              icon={Image}
              title="Digital Image Enhancer"
              description="Transform normal images into high-quality digital versions"
              to="/digital-enhancer"
            />
            <FeatureCard
              icon={Images}
              title="PDF to Images"
              description="Extract and convert PDF pages to high-quality images"
              to="/pdf-tools?tab=to-images"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-8 sm:mb-12">
            How It Works
          </h2>
          <div className="max-w-3xl mx-auto space-y-8 sm:space-y-12">
            <StepCard
              number={1}
              title="Upload Your File"
              description="Drag and drop your files or click to browse"
            />
            <StepCard
              number={2}
              title="Choose Format"
              description="Select your desired output format"
            />
            <StepCard
              number={3}
              title="Download"
              description="Get your converted file instantly"
            />
          </div>
        </div>
      </section>
    </>
  );
}

let setAuthModalOpen: (open: boolean) => void;
let setAuthMode: (mode: 'login' | 'signup' | 'forgot-password') => void;

function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpenState] = useState(false);
  const [authMode, setAuthModeState] = useState<'login' | 'signup' | 'forgot-password'>('signup');

  setAuthModalOpen = setAuthModalOpenState;
  setAuthMode = setAuthModeState;

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const openAuthModal = (mode: 'login' | 'signup' | 'forgot-password') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
    setMobileMenuOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16">
          <div className="flex items-center justify-between h-full">
            <div className="flex-shrink-0">
              <Link to="/" className="flex items-center space-x-2">
                <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600" />
                <span className="text-xl sm:text-2xl font-bold text-gray-900">Hallopdf</span>
              </Link>
            </div>

            <div className="hidden sm:flex items-center justify-center flex-1 px-8">
              <div className="flex space-x-6">
                <Link to="/" className="text-gray-600 hover:text-gray-900">Home</Link>
                <Link to="/image-tools" className="text-gray-600 hover:text-gray-900">Image Size Reduce </Link>
                <Link to="/pdf-tools" className="text-gray-600 hover:text-gray-900">PDF Tools</Link>
                <Link to="/digital-enhancer" className="text-gray-600 hover:text-gray-900">Digital Enhancer</Link>
              </div>
            </div>

            <div className="hidden sm:flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-gray-600">{user.email}</span>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => openAuthModal('login')}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Log In
                  </button>
                  <button
                    onClick={() => openAuthModal('signup')}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>

            <button
              className="sm:hidden text-gray-600 hover:text-gray-900"
              onClick={toggleMobileMenu}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </nav>

        {mobileMenuOpen && (
          <div className="sm:hidden bg-white border-t border-gray-200">
            <div className="px-4 py-3 space-y-3">
              <Link
                to="/"
                className="block text-gray-600 hover:text-gray-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/image-tools"
                className="block text-gray-600 hover:text-gray-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Image Size Reduce
              </Link>
              <Link
                to="/pdf-tools"
                className="block text-gray-600 hover:text-gray-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                PDF Tools
              </Link>
              <Link
                to="/digital-enhancer"
                className="block text-gray-600 hover:text-gray-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Digital Enhancer
              </Link>
              {user ? (
                <>
                  <div className="py-2 text-gray-600">{user.email}</div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center space-x-2 text-gray-600 hover:text-gray-900 py-2"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => openAuthModal('login')}
                    className="w-full text-left text-gray-600 hover:text-gray-900 py-2"
                  >
                    Log In
                  </button>
                  <button
                    onClick={() => openAuthModal('signup')}
                    className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {children}

      <footer className="bg-gray-900 text-white py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <FileText className="w-6 h-6" />
                <span className="text-xl font-bold">Hallopdf</span>
              </div>
              <p className="text-gray-400">
                Your all-in-one solution for document and image conversion
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li><Link to="/" className="text-gray-400 hover:text-white">Home</Link></li>
                <li><Link to="/image-tools" className="text-gray-400 hover:text-white">Image Size Reduce</Link></li>
                <li><Link to="/pdf-tools" className="text-gray-400 hover:text-white">PDF Tools</Link></li>
                <li><Link to="/digital-enhancer" className="text-gray-400 hover:text-white">Digital Enhancer</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link to="/privacy" className="text-gray-400 hover:text-white">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-gray-400 hover:text-white">Terms of Service</Link></li>
                <li><Link to="/contact" className="text-gray-400 hover:text-white">Contact Us</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 sm:mt-12 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} Hallopdf. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
      />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/image-tools" element={<ImageTools />} />
            <Route path="/pdf-tools" element={<PDFTools />} />
            <Route path="/html-to-pdf" element={<HTMLToPDF />} />
            <Route path="/digital-enhancer" element={<DigitalImageEnhancer />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
          <StickyBottomAd />
        </Layout>
      </AuthProvider>
    </Router>
  );
}

export default App;