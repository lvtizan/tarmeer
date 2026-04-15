import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <Helmet>
        <title>Page Not Found - Tarmeer</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <h1 className="font-serif text-6xl font-bold text-[#2c2c2c] mb-4">404</h1>
      <p className="text-lg text-[#6b6b6b] mb-8">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary">Back to Home</Link>
    </div>
  );
}
