import { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

/** Inner page width should match top navigation: max-w-6xl mx-auto px-4 sm:px-6 */
export default function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`max-w-6xl mx-auto px-4 sm:px-6 ${className}`.trim()}>
      {children}
    </div>
  );
}
