import PageContainer from '../components/PageContainer';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <PageContainer className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-serif text-3xl lg:text-4xl font-bold text-[#2c2c2c] mb-8">
            Privacy Policy
          </h1>
          
          <div className="prose prose-stone max-w-none">
            <p className="text-[#6b6b6b] mb-6">
              Thank you for visiting Tarmeer Website (www.tarmeer.com, hereinafter referred to as "this Website"). We understand the importance of your personal information security. This Privacy Policy is intended to detail how we collect, use, store, and protect your personal information when you use the services of this Website (including but not limited to consulting decoration plans, booking design services, purchasing home products, browsing decoration cases, etc.), as well as the rights you have regarding your personal information. Please read and understand this Policy carefully before using the services of this Website. By continuing to use this Website, you agree that we will process your personal information in accordance with this Policy.
            </p>

            <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] mt-8 mb-4">
              Information We Collect
            </h2>
            <p className="text-[#6b6b6b] mb-4">
              We only collect information necessary for providing services, which is specifically divided into the following two categories:
            </p>

            <h3 className="text-xl font-semibold text-[#2c2c2c] mt-6 mb-3">
              Necessary Information (services cannot be completed without providing it):
            </h3>
            <ul className="list-disc list-inside text-[#6b6b6b] space-y-2 mb-4">
              <li><strong>Basic personal information:</strong> Name, mobile phone number, email address (used for communicating decoration needs, confirming service bookings, and sending order/construction progress notifications)</li>
              <li><strong>Address information:</strong> Decoration property address, city/region, property layout (used for on-site measurement, customizing design plans, and arranging construction teams or product delivery)</li>
              <li><strong>Service demand information:</strong> Decoration style preference, budget range, property area, special needs (e.g., adaptation for the elderly/children) (used for developing decoration plans that meet your needs)</li>
            </ul>

            <h3 className="text-xl font-semibold text-[#2c2c2c] mt-6 mb-3">
              Non-Necessary Information (optional to provide, used to improve service experience):
            </h3>
            <ul className="list-disc list-inside text-[#6b6b6b] space-y-2 mb-4">
              <li><strong>Preference information:</strong> Browsing history, saved decoration cases/home products (used for recommending more matching plans or products)</li>
              <li><strong>Device information:</strong> Browser type, IP address, access time, device model (used for optimizing website performance and troubleshooting access issues, not associated with personal identity)</li>
            </ul>

            <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] mt-8 mb-4">
              How We Use Your Information
            </h2>
            <p className="text-[#6b6b6b] mb-4">
              The personal information we collect is only used for the following scenarios, which are directly related to the business of this Website:
            </p>
            <ul className="list-disc list-inside text-[#6b6b6b] space-y-2 mb-4">
              <li><strong>Providing core services:</strong> Developing decoration design plans based on your needs, arranging on-site measurement/construction services, processing product orders, and following up on service progress</li>
              <li><strong>Communication and notification:</strong> Informing you of service progress (e.g., design plan confirmation, construction time adjustment), order status (e.g., product shipment) via phone, SMS, or email, or sending necessary information such as decoration precautions</li>
              <li><strong>Optimizing services and the Website:</strong> Improving website functions (e.g., simplifying the booking process) and adjusting content recommendations (e.g., displaying more decoration styles you prefer) based on user usage data</li>
              <li><strong>Compliance and security:</strong> Preventing fraud, protecting the legitimate rights and interests of this Website and users, or providing necessary information to regulatory authorities in accordance with legal and regulatory requirements (not used for other unrelated purposes)</li>
            </ul>

            <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] mt-8 mb-4">
              Information Sharing and Disclosure
            </h2>
            <p className="text-[#6b6b6b] mb-4">
              We strictly protect your personal information and will not share or disclose it arbitrarily:
            </p>
            <ul className="list-disc list-inside text-[#6b6b6b] space-y-2 mb-4">
              <li><strong>No active sharing:</strong> We will not sell or rent your personal information to any third-party institutions or individuals unless we obtain your explicit written consent</li>
              <li><strong>Necessary sharing (only for service completion):</strong> We may share necessary information (e.g., property address, name, contact information) with cooperating third-party service providers (e.g., decoration construction teams, logistics companies, home product suppliers). However, we will require third parties to comply with the relevant requirements of this Privacy Policy, and the information is only used to provide services for you</li>
              <li><strong>Statutory disclosure:</strong> When required by laws, administrative regulations, or regulatory authorities, or to protect the legitimate rights and interests of Tarmeer, users, and the public (e.g., responding to security risks, fraud), we will disclose necessary information in accordance with the law</li>
            </ul>

            <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] mt-8 mb-4">
              Information Storage and Security
            </h2>
            <ul className="list-disc list-inside text-[#6b6b6b] space-y-2 mb-4">
              <li><strong>Storage period:</strong> Your personal information will only be stored for the period necessary to provide services to you (e.g., after the service is completed, if you have no subsequent needs, we will delete or anonymize your information within 1 year, unless otherwise required by laws and regulations)</li>
              <li><strong>Storage location:</strong> Your personal information is only stored on compliant servers in the Chinese mainland and will not be transferred across borders (unless we obtain your consent and comply with cross-border data transfer rules)</li>
              <li><strong>Security measures:</strong> We adopt technical and management measures such as data encryption (during transmission and storage), access permission control (only authorized personnel can view), and regular security inspections to prevent unauthorized access, disclosure, or tampering of information</li>
              <li><strong>Disclaimer:</strong> The Internet environment is uncertain. If information leakage occurs due to force majeure (e.g., hacker attacks, network failures), we will immediately take remedial measures and inform you in accordance with the law</li>
            </ul>

            <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] mt-8 mb-4">
              Your Rights
            </h2>
            <p className="text-[#6b6b6b] mb-4">
              You have the following rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside text-[#6b6b6b] space-y-2 mb-4">
              <li><strong>Right to access:</strong> You have the right to request access to your personal information held by us</li>
              <li><strong>Right to correction:</strong> You have the right to request correction of inaccurate or incomplete personal information</li>
              <li><strong>Right to deletion:</strong> Under certain circumstances, you have the right to request deletion of your personal information</li>
              <li><strong>Right to restrict processing:</strong> Under certain circumstances, you have the right to request restriction of processing of your personal information</li>
              <li><strong>Right to data portability:</strong> You have the right to request a copy of your personal information in a structured, commonly used, and machine-readable format</li>
            </ul>

            <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] mt-8 mb-4">
              Contact Us
            </h2>
            <p className="text-[#6b6b6b] mb-4">
              If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <p className="text-[#6b6b6b] mb-4">
              WhatsApp: +971 58 838 8922<br />
              Address: 1 - 2a 147 street - Al Sajaa - Sharjah - United Arab Emirates
            </p>

            <p className="text-[#6b6b6b] mt-8 text-sm">
              Last updated: {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
