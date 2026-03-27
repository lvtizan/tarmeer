-- Seed data: 30 UAE home renovation companies
-- Generated: 2026-03-27
-- Run: mysql -u root -p tarmeer < server/schema/seed-uae-companies.sql

USE tarmeer;

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Algedra Interior Design', 'الكيدرا للتصميم الداخلي', 'algedra', '/images/uae-companies/logos/algedra.png', NULL,
  '+971 52 811 1106', 'hello@algedra.ae', 'https://algedra.ae', '+971528111106',
  'Dubai', 'Business Bay', 'Office 2501, Al Manara Tower, Business Bay, Dubai, UAE',
  '["Interior Design","Architecture","Landscape Design","Fit-Out","Furniture"]', '["Residential","Commercial","Hospitality","Villa"]', '2014',
  4.5, 320, 'official_website',
  'https://www.instagram.com/algedradesign', 'https://www.facebook.com/algedradesign', 'https://www.linkedin.com/company/algedra/',
  '["/images/uae-companies/portfolio/algedra/1.png"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Luxury Antonovich Design', 'أنتونوفيتش للتصميم الفاخر', 'antonovich-design', '/images/uae-companies/logos/antonovich-design.jpg', NULL,
  '+971 54 299 5555', 'info@antonovich-group.ae', 'https://antonovich-design.ae', '+971542995555',
  'Dubai', 'Business Bay', 'Business Bay, Dubai, UAE',
  '["Interior Design","Fit-Out","Construction","Landscape","Furniture"]', '["Residential","Commercial","Hospitality","Villa"]', '2010',
  4.8, 580, 'official_website',
  'https://instagram.com/antonovich.design.dubai/', 'https://www.facebook.com/luxury.antonovich.design/', 'https://www.linkedin.com/company/antonovichdesign/',
  '["/images/uae-companies/portfolio/antonovich-design/1.webp","/images/uae-companies/portfolio/antonovich-design/2.webp","/images/uae-companies/portfolio/antonovich-design/3.webp","/images/uae-companies/portfolio/antonovich-design/4.jpg"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Appello Interiors', 'أبيلو للتصاميم الداخلية', 'appello-interiors', '/images/uae-companies/logos/appello-interiors.png', NULL,
  '+971 52 447 4455', 'info@appellointeriors.com', 'https://www.appellointeriors.com', '+971524474455',
  'Dubai', 'Al Quoz', 'Al Quoz, Dubai, UAE',
  '["Interior Design","Fit-Out","Renovation","Carpentry"]', '["Residential","Commercial","Retail"]', '2015',
  4.6, 210, 'web_search',
  'https://www.instagram.com/appellointeriors', 'https://www.facebook.com/appellointeriors', NULL,
  '["/images/uae-companies/portfolio/appello-interiors/1.png","/images/uae-companies/portfolio/appello-interiors/2.png","/images/uae-companies/portfolio/appello-interiors/3.webp","/images/uae-companies/portfolio/appello-interiors/4.jpg"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Fitout Squad', 'فيت أوت سكواد', 'fitout-squad', '/images/uae-companies/logos/fitout-squad.png', NULL,
  '+971 4 580 6498', 'info@fitoutsquad.com', 'https://fitoutsquad.com', '+971585886498',
  'Dubai', 'Al Quoz', 'Al Quoz Industrial Area, Dubai, UAE',
  '["Interior Fit-Out","Design Consultation","Space Planning","Construction"]', '["Residential","Commercial","Office"]', '2018',
  4.7, 150, 'web_search',
  'https://www.instagram.com/fitoutsquad', 'https://www.facebook.com/fitoutsquad', NULL,
  '["/images/uae-companies/portfolio/fitout-squad/1.png","/images/uae-companies/portfolio/fitout-squad/2.png","/images/uae-companies/portfolio/fitout-squad/3.png","/images/uae-companies/portfolio/fitout-squad/4.png"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'USBC Interiors', 'يو إس بي سي للتصاميم الداخلية', 'usbc-interiors', '/images/uae-companies/logos/usbc-interiors.png', NULL,
  '+971 4 552 5858', 'info@usbcinteriors.com', 'https://www.usbcinteriors.com', '+97145525858',
  'Dubai', 'Al Quoz', 'Al Quoz, Dubai, UAE',
  '["Interior Fit-Out","Design","Turnkey Solutions","Project Management"]', '["Office","Retail","Residential","Hospitality"]', '2012',
  4.5, 175, 'web_search',
  'https://www.instagram.com/usbcinteriors', 'https://www.facebook.com/usbcinteriors', 'https://www.linkedin.com/company/usbcinteriors/',
  '["/images/uae-companies/portfolio/usbc-interiors/1.jpg","/images/uae-companies/portfolio/usbc-interiors/2.jpg","/images/uae-companies/portfolio/usbc-interiors/3.jpg","/images/uae-companies/portfolio/usbc-interiors/4.jpg"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Build Craft Interiors', 'بيلد كرافت للتصاميم الداخلية', 'build-craft-interiors', '/images/uae-companies/logos/build-craft-interiors.webp', NULL,
  '+971 52 963 2272', 'info@buildcraftinteriors.com', 'https://www.buildcraftinteriors.com', '+971529632272',
  'Dubai', 'Al Quoz', 'Al Quoz Industrial Area 3, Dubai, UAE',
  '["Interior Fit-Out","Renovation","Carpentry","MEP Works"]', '["Residential","Commercial","Retail"]', '2016',
  4.4, 95, 'web_search',
  'https://www.instagram.com/buildcraftinteriors', NULL, NULL,
  '["/images/uae-companies/portfolio/build-craft-interiors/1.png","/images/uae-companies/portfolio/build-craft-interiors/2.png","/images/uae-companies/portfolio/build-craft-interiors/3.png","/images/uae-companies/portfolio/build-craft-interiors/4.png"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Horton Interiors', 'هورتون للتصاميم الداخلية', 'horton-interiors', '/images/uae-companies/logos/horton-interiors.png', NULL,
  '+971 4 347 0303', 'info@hortoninteriors.com', 'https://hortoninteriors.com', '+971543470303',
  'Dubai', 'Sheikh Zayed Road', 'Office 227, Al Shafar Investment Building, Sheikh Zayed Road, P.O. Box 390984, Dubai, UAE',
  '["Fit-Out","Interior Design","Renovation","Project Management"]', '["Residential","Office","Retail","Healthcare","Hospitality"]', '2005',
  4.3, 130, 'web_search',
  'https://www.instagram.com/hortoninteriors', 'https://www.facebook.com/hortoninteriors', 'https://www.linkedin.com/company/horton-interiors/',
  '["/images/uae-companies/portfolio/horton-interiors/1.png","/images/uae-companies/portfolio/horton-interiors/2.png","/images/uae-companies/portfolio/horton-interiors/3.jpg","/images/uae-companies/portfolio/horton-interiors/4.jpg"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Fitout Bureau Interiors', 'فيت أوت بيورو', 'fitout-bureau', '/images/uae-companies/logos/fitout-bureau.png', NULL,
  '+971 55 439 3355', 'info@fitoutbureau.com', 'https://www.fitoutbureau.com', '+971554393355',
  'Dubai', 'Deira', 'Deira, Dubai, UAE',
  '["Interior Fit-Out","Design","Renovation","Joinery"]', '["Residential","Commercial","Retail"]', '2017',
  4.6, 88, 'web_search',
  'https://www.instagram.com/fitoutbureau', 'https://www.facebook.com/fitoutbureau', NULL,
  '["/images/uae-companies/portfolio/fitout-bureau/1.png","/images/uae-companies/portfolio/fitout-bureau/2.jpg","/images/uae-companies/portfolio/fitout-bureau/3.jpg","/images/uae-companies/portfolio/fitout-bureau/4.jpg"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'MGM Interiors', 'إم جي إم للتصاميم الداخلية', 'mgm-interiors', '/images/uae-companies/logos/mgm-interiors.png', NULL,
  '+971 4 339 2225', 'info@mgminteriorsuae.com', 'https://mgminteriorsuae.com', '+971543392225',
  'Dubai', 'Al Quoz', 'Al Quoz Industrial Area, Dubai, UAE',
  '["Interior Fit-Out","Design","Renovation","Maintenance"]', '["Residential","Commercial","Hospitality","Retail"]', '1998',
  4.4, 200, 'web_search',
  'https://www.instagram.com/mgminteriorsuae', 'https://www.facebook.com/mgminteriorsuae', NULL,
  '["/images/uae-companies/portfolio/mgm-interiors/1.webp","/images/uae-companies/portfolio/mgm-interiors/2.png","/images/uae-companies/portfolio/mgm-interiors/3.webp","/images/uae-companies/portfolio/mgm-interiors/4.webp"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'ALEC Fitout', 'أليك فيت آوت', 'alec-fitout', NULL, NULL,
  '+971 4 338 8477', 'info@alecfitout.ae', 'https://www.alecfitout.ae', NULL,
  'Dubai', 'Jebel Ali', 'Jebel Ali Industrial Area, Dubai, UAE',
  '["Luxury Fit-Out","Refurbishment","Design & Build","Joinery"]', '["Hospitality","Residential","Commercial","Retail"]', '2008',
  4.5, 65, 'web_search',
  'https://www.instagram.com/alecfitout', 'https://www.facebook.com/alecfitout', 'https://www.linkedin.com/company/alec-fitout/',
  '["/images/uae-companies/portfolio/alec-fitout/1.png","/images/uae-companies/portfolio/alec-fitout/2.png","/images/uae-companies/portfolio/alec-fitout/3.png","/images/uae-companies/portfolio/alec-fitout/4.jpg"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Fix It Design', 'فيكس إت ديزاين', 'fix-it-design', '/images/uae-companies/logos/fix-it-design.png', NULL,
  '+971 55 472 2980', 'info@fixitdesign.ae', 'https://fixitdesign.ae', '+971554722980',
  'Dubai', 'Al Quoz', '4th St, Al Qouz First, Al Quoz, Dubai, UAE',
  '["Interior Design","Curtains","Blinds","Flooring","Renovation"]', '["Residential","Villa","Apartment"]', '2019',
  4.7, 145, 'web_search',
  'https://www.instagram.com/fixitdesign.ae', 'https://www.facebook.com/fixitdesign.ae', NULL,
  '["/images/uae-companies/portfolio/fix-it-design/1.png","/images/uae-companies/portfolio/fix-it-design/2.png","/images/uae-companies/portfolio/fix-it-design/3.png","/images/uae-companies/portfolio/fix-it-design/4.png"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'WE DO Design & Fitout', 'وي دو للتصميم والتجهيز', 'we-do-design', NULL, NULL,
  '+971 54 496 2132', 'info@wedodesign.ae', 'https://www.wedodesign.ae', '+971544962132',
  'Dubai', 'Business Bay', '2 Marasi Dr, Business Bay, Dubai, UAE',
  '["Interior Design","Fit-Out","Renovation","Turnkey Solutions"]', '["Residential","Commercial","Office"]', '2019',
  4.8, 72, 'houzz',
  'https://www.instagram.com/wedodesignfitout', NULL, NULL,
  '[]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Hiyam Designs', 'هيام للتصاميم', 'hiyam-designs', NULL, NULL,
  '+971 4 425 9850', 'info@hiyamdesigns.com', 'https://www.hiyamdesigns.com', '+971544259850',
  'Dubai', 'Dubai Silicon Oasis', 'Dubai Silicon Oasis, Dubai, UAE',
  '["Architecture","Interior Design","Landscape","MEP"]', '["Residential","Commercial"]', '2015',
  4.6, 55, 'houzz',
  'https://www.instagram.com/hiyamdesigns', 'https://www.facebook.com/hiyamdesigns', NULL,
  '[]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'INC Solutions', 'آي إن سي سوليوشنز', 'inc-solutions', '/images/uae-companies/logos/inc-solutions.png', NULL,
  '+971 4 321 8877', 'info@inc-solutions.com', 'https://www.inc-solutions.com', NULL,
  'Dubai', 'Al Quoz', 'Al Quoz Industrial Area, Dubai, UAE',
  '["Interior Fit-Out","Design","Joinery","MEP"]', '["Luxury Residential","Commercial","Hospitality"]', '2013',
  4.5, 110, 'web_search',
  'https://www.instagram.com/incsolutions', 'https://www.facebook.com/incsolutions', 'https://www.linkedin.com/company/inc-solutions/',
  '["/images/uae-companies/portfolio/inc-solutions/1.png","/images/uae-companies/portfolio/inc-solutions/2.jpg","/images/uae-companies/portfolio/inc-solutions/3.jpg","/images/uae-companies/portfolio/inc-solutions/4.jpg"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Arcave Design', 'آركيف للتصميم', 'arcave-design', '/images/uae-companies/logos/arcave-design.png', NULL,
  '+971 2 644 4420', 'info@arcave.ae', 'https://arcave.ae', '+971526444420',
  'Abu Dhabi', 'Al Reem Island', 'Al Reem Island, Abu Dhabi, UAE',
  '["Architecture","Interior Design","Landscape","Fit-Out"]', '["Residential","Commercial","Hospitality"]', '2016',
  4.7, 85, 'web_search',
  'https://www.instagram.com/arcave.ae', 'https://www.facebook.com/arcave.ae', NULL,
  '["/images/uae-companies/portfolio/arcave-design/1.jpg","/images/uae-companies/portfolio/arcave-design/2.jpg","/images/uae-companies/portfolio/arcave-design/3.webp","/images/uae-companies/portfolio/arcave-design/4.jpg"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Patina Interiors', 'باتينا للتصاميم الداخلية', 'patina-interiors', NULL, NULL,
  '+971 800 728462', 'info@patina.ae', 'https://www.patina.ae', NULL,
  'Abu Dhabi', 'Capital Centre', 'Level 2, Bin Hamoodah Tower, Capital Centre, Abu Dhabi, UAE',
  '["Interior Design","Fit-Out","Furniture","Project Management"]', '["Residential","Commercial","Hospitality"]', '2010',
  4.4, 95, 'web_search',
  'https://www.instagram.com/patinainteriors', 'https://www.facebook.com/patinainteriors', 'https://www.linkedin.com/company/patina-interiors/',
  '[]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Winteriors Décor', 'وينتيريورز ديكور', 'winteriors-decor', '/images/uae-companies/logos/winteriors-decor.png', NULL,
  '+971 4 454 2366', 'info@winteriorsdecor.com', 'https://www.winteriorsdecor.com', '+971544542366',
  'Dubai', 'Dubai Media City', '1706, Concord Tower, Dubai Media City, P.O. Box 643859, Dubai, UAE',
  '["Interior Design","Fit-Out","Turnkey Solutions"]', '["Commercial","Office","Retail"]', '2008',
  4.3, 70, 'web_search',
  'https://www.instagram.com/winteriorsdecor', 'https://www.facebook.com/winteriorsdecor', 'https://www.linkedin.com/company/winteriors-decor/',
  '["/images/uae-companies/portfolio/winteriors-decor/1.jpg","/images/uae-companies/portfolio/winteriors-decor/2.jpg","/images/uae-companies/portfolio/winteriors-decor/3.jpg","/images/uae-companies/portfolio/winteriors-decor/4.jpg"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Safeway Groups', 'سيف واي جروبس', 'safeway-groups', '/images/uae-companies/logos/safeway-groups.png', NULL,
  '+971 2 672 5566', 'info@safewaygroups.com', 'https://www.safewaygroups.com', NULL,
  'Abu Dhabi', 'Mussafah', 'Mussafah Industrial Area, Abu Dhabi, UAE',
  '["Interior Design","Fit-Out","Construction","Maintenance"]', '["Residential","Commercial","Government"]', '1985',
  4.2, 120, 'web_search',
  'https://www.instagram.com/safewaygroups', 'https://www.facebook.com/safewaygroups', NULL,
  '["/images/uae-companies/portfolio/safeway-groups/1.webp","/images/uae-companies/portfolio/safeway-groups/2.webp","/images/uae-companies/portfolio/safeway-groups/3.webp","/images/uae-companies/portfolio/safeway-groups/4.webp"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Luxury & More Interiors', 'لاكشري آند مور', 'luxury-and-more', '/images/uae-companies/logos/luxury-and-more.png', NULL,
  '+971 2 558 8006', 'info@luxuryandmore.net', 'https://luxuryandmore.net', '+971525588006',
  'Abu Dhabi', 'Khalifa City', 'Khalifa City, Abu Dhabi, UAE',
  '["Interior Design","Renovation","Furniture","Décor"]', '["Residential","Villa","Apartment"]', '2015',
  4.6, 60, 'web_search',
  'https://www.instagram.com/luxuryandmore.ae', 'https://www.facebook.com/luxuryandmore', NULL,
  '["/images/uae-companies/portfolio/luxury-and-more/1.jpg","/images/uae-companies/portfolio/luxury-and-more/2.avif","/images/uae-companies/portfolio/luxury-and-more/3.avif","/images/uae-companies/portfolio/luxury-and-more/4.avif"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'La Firma Interiors', 'لا فيرما للتصاميم الداخلية', 'la-firma', '/images/uae-companies/logos/la-firma.jpg', NULL,
  '+971 50 393 0668', 'info@lafirma.ae', 'https://lafirma.ae', '+971503930668',
  'Dubai', 'Al Wasl', 'Al Wasl Road, Dubai, UAE',
  '["Interior Design","Fit-Out","Villa Design","Furniture"]', '["Residential","Villa","Luxury"]', '2017',
  4.8, 90, 'web_search',
  'https://www.instagram.com/lafirma.ae', 'https://www.facebook.com/lafirma.ae', NULL,
  '["/images/uae-companies/portfolio/la-firma/1.png","/images/uae-companies/portfolio/la-firma/2.svg","/images/uae-companies/portfolio/la-firma/3.png","/images/uae-companies/portfolio/la-firma/4.jpg"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'CK Architecture Interiors', 'سي كي للعمارة والتصميم الداخلي', 'ck-architecture', '/images/uae-companies/logos/ck-architecture.png', NULL,
  '+971 4 380 7788', 'info@ckarchitecture.com', 'https://ckarchitecture.com', '+971543807788',
  'Dubai', 'Downtown Dubai', 'Downtown Dubai, UAE',
  '["Architecture","Interior Design","Landscape","Fit-Out"]', '["Luxury Residential","Hospitality","Commercial"]', '2012',
  4.7, 105, 'web_search',
  'https://www.instagram.com/ckarchitecture', 'https://www.facebook.com/ckarchitecture', 'https://www.linkedin.com/company/ck-architecture/',
  '["/images/uae-companies/portfolio/ck-architecture/1.jpg","/images/uae-companies/portfolio/ck-architecture/2.jpg","/images/uae-companies/portfolio/ck-architecture/3.jpg","/images/uae-companies/portfolio/ck-architecture/4.jpg"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Blak Interiors', 'بلاك للتصاميم الداخلية', 'blak-interiors', '/images/uae-companies/logos/blak-interiors.png', NULL,
  '+971 4 385 5575', 'info@blakinteriors.com', 'https://blakinteriors.com', '+971543855575',
  'Dubai', 'Al Quoz', 'Al Quoz Industrial Area, Dubai, UAE',
  '["Interior Design","Fit-Out","Renovation","Joinery"]', '["Luxury Residential","Villa","Penthouse"]', '2010',
  4.6, 135, 'web_search',
  'https://www.instagram.com/blakinteriors', 'https://www.facebook.com/blakinteriors', NULL,
  '["/images/uae-companies/portfolio/blak-interiors/1.png","/images/uae-companies/portfolio/blak-interiors/2.jpg","/images/uae-companies/portfolio/blak-interiors/3.jpg","/images/uae-companies/portfolio/blak-interiors/4.jpg"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Rayfitout', 'راي فيت آوت', 'rayfitout', '/images/uae-companies/logos/rayfitout.svg', NULL,
  '+971 4 252 6500', 'info@rayfitout.com', 'https://rayfitout.com', '+971542526500',
  'Dubai', 'Al Quoz', 'Al Quoz, Dubai, UAE',
  '["Interior Design","Fit-Out","Construction","Renovation"]', '["Residential","Commercial","Hospitality"]', '1993',
  4.7, 240, 'web_search',
  'https://www.instagram.com/rayfitout', 'https://www.facebook.com/rayfitout', 'https://www.linkedin.com/company/rayfitout/',
  '["/images/uae-companies/portfolio/rayfitout/1.webp","/images/uae-companies/portfolio/rayfitout/2.webp","/images/uae-companies/portfolio/rayfitout/3.webp","/images/uae-companies/portfolio/rayfitout/4.webp"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Luxe Design Villas', 'لوكس ديزاين فيلاز', 'luxe-design-villas', '/images/uae-companies/logos/luxe-design-villas.svg', NULL,
  '+971 4 399 8800', 'info@luxedesign.ae', 'https://www.luxedesign.ae', '+971543998800',
  'Dubai', 'Jumeirah', 'Jumeirah, Dubai, UAE',
  '["Villa Construction","Interior Fit-Out","Design","Renovation"]', '["Luxury Villa","Residential"]', '2016',
  4.5, 78, 'web_search',
  'https://www.instagram.com/luxedesignvillas', 'https://www.facebook.com/luxedesignvillas', NULL,
  '["/images/uae-companies/portfolio/luxe-design-villas/1.webp","/images/uae-companies/portfolio/luxe-design-villas/2.webp","/images/uae-companies/portfolio/luxe-design-villas/3.webp","/images/uae-companies/portfolio/luxe-design-villas/4.webp"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Klick UAE', 'كليك الإمارات', 'klick-uae', '/images/uae-companies/logos/klick-uae.png', NULL,
  '+971 4 321 6643', 'info@klickuae.com', 'https://klickuae.com', '+971543216643',
  'Dubai', 'Business Bay', 'Business Bay, Dubai, UAE',
  '["Interior Fit-Out","Design","Renovation","Maintenance"]', '["Residential","Commercial","Office"]', '2018',
  4.5, 55, 'web_search',
  'https://www.instagram.com/klickuae', 'https://www.facebook.com/klickuae', NULL,
  '["/images/uae-companies/portfolio/klick-uae/1.jpg","/images/uae-companies/portfolio/klick-uae/2.jpg","/images/uae-companies/portfolio/klick-uae/3.jpg","/images/uae-companies/portfolio/klick-uae/4.jpg"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'ATG Interiors', 'إيه تي جي للتصاميم الداخلية', 'atg-interiors', '/images/uae-companies/logos/atg-interiors.svg', NULL,
  '+971 4 347 8000', 'info@atginteriors.com', 'https://www.atginteriors.com', NULL,
  'Dubai', 'Al Quoz', 'Al Quoz Industrial Area 3, Dubai, UAE',
  '["Interior Fit-Out","Joinery","Furniture","MEP"]', '["Hospitality","Commercial","Retail","Residential"]', '2004',
  4.3, 90, 'web_search',
  'https://www.instagram.com/atginteriors', 'https://www.facebook.com/atginteriors', 'https://www.linkedin.com/company/atg-interiors/',
  '["/images/uae-companies/portfolio/atg-interiors/1.jpg","/images/uae-companies/portfolio/atg-interiors/2.webp","/images/uae-companies/portfolio/atg-interiors/3.webp","/images/uae-companies/portfolio/atg-interiors/4.webp"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Eminent Interio', 'إمينينت إنتيريو', 'eminent-interio', '/images/uae-companies/logos/eminent-interio.webp', NULL,
  '+971 2 633 4499', 'info@eminentinterio.com', 'https://eminentinterio.com', '+971526334499',
  'Abu Dhabi', 'Al Reem Island', 'Al Reem Island, Abu Dhabi, UAE',
  '["Design & Build","Interior Fit-Out","Renovation"]', '["Commercial","Hospitality","Office"]', '2011',
  4.6, 75, 'web_search',
  'https://www.instagram.com/eminentinterio', 'https://www.facebook.com/eminentinterio', 'https://www.linkedin.com/company/eminent-interio/',
  '["/images/uae-companies/portfolio/eminent-interio/1.webp","/images/uae-companies/portfolio/eminent-interio/2.webp","/images/uae-companies/portfolio/eminent-interio/3.webp","/images/uae-companies/portfolio/eminent-interio/4.webp"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Decor Home', 'ديكور هوم', 'decor-home', '/images/uae-companies/logos/decor-home.png', NULL,
  '+971 50 822 4488', 'info@decorshomes.com', 'https://decorshomes.com', '+971508224488',
  'Abu Dhabi', 'Khalifa City', 'Khalifa City, Abu Dhabi, UAE',
  '["Interior Design","Painting","Maintenance","Renovation"]', '["Residential","Villa","Apartment"]', '2005',
  4.4, 180, 'web_search',
  'https://www.instagram.com/decorshomes', 'https://www.facebook.com/decorshomes', NULL,
  '["/images/uae-companies/portfolio/decor-home/1.png","/images/uae-companies/portfolio/decor-home/2.png","/images/uae-companies/portfolio/decor-home/3.png","/images/uae-companies/portfolio/decor-home/4.png"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'SMD Decoration', 'إس إم دي للديكور', 'smd-decoration', '/images/uae-companies/logos/smd-decoration.webp', NULL,
  '+971 50 655 8800', 'info@smddecoration.ae', 'https://smddecoration.ae', '+971506558800',
  'Dubai', 'Deira', 'Deira, Dubai, UAE',
  '["Interior Design","Painting","Gypsum","Décor"]', '["Residential","Commercial"]', '2012',
  4.3, 65, 'web_search',
  'https://www.instagram.com/smddecoration', 'https://www.facebook.com/smddecoration', NULL,
  '["/images/uae-companies/portfolio/smd-decoration/1.png","/images/uae-companies/portfolio/smd-decoration/2.png","/images/uae-companies/portfolio/smd-decoration/3.webp","/images/uae-companies/portfolio/smd-decoration/4.webp"]', 1
);

INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  'Accouter Design', 'أكوتر للتصميم', 'accouter-design', '/images/uae-companies/logos/accouter-design.png', NULL,
  '+971 4 348 9966', 'info@accouterdesign.com', 'https://accouterdesign.com', '+971543489966',
  'Dubai', 'Al Quoz', 'Al Quoz, Dubai, UAE',
  '["Interior Design","Villa Design","Fit-Out","Furniture"]', '["Luxury Villa","Penthouse","Residential"]', '2007',
  4.7, 95, 'web_search',
  'https://www.instagram.com/accouterdesign', 'https://www.facebook.com/accouterdesign', 'https://www.linkedin.com/company/accouter-design/',
  '["/images/uae-companies/portfolio/accouter-design/1.jpg","/images/uae-companies/portfolio/accouter-design/2.jpg","/images/uae-companies/portfolio/accouter-design/3.jpg","/images/uae-companies/portfolio/accouter-design/4.jpg"]', 1
);

