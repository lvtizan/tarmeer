-- Seed fake data for admin dashboard preview
-- Run after init + admin_tables: mysql -u root -p tarmeer < server/schema/seed-admin-demo.sql
-- Designer login password for all seed accounts: password123

USE tarmeer;

-- Avoid duplicate seed runs
DELETE FROM designer_stats WHERE designer_id >= 100;
DELETE FROM projects WHERE designer_id >= 100;
DELETE FROM designers WHERE id >= 100;

-- Seed designers: 3 pending, 7 approved, 2 rejected
-- Password hash for 'password123' (bcrypt 12 rounds)
SET @pwd = '$2a$12$7GHd0HwbYieDMpp1mt6hr.1vWeP20boU9m6IZQqFlCkfKnL7f4Ghe';

INSERT INTO designers (id, email, password, full_name, phone, city, bio, avatar_url, style, expertise, is_approved, email_verified, status, display_order, rejection_reason, created_at) VALUES
(101, 'sara.ahmed@example.ae', @pwd, 'Sara Ahmed', '+971501234101', 'Dubai', 'Interior designer specializing in modern Arabic and contemporary spaces. 10+ years in UAE.', 'https://i.pravatar.cc/150?u=sara101', 'Modern Arabic', '["Residential","Villa","Luxury"]', 0, 1, 'pending', 0, NULL, DATE_SUB(NOW(), INTERVAL 2 DAY)),
(102, 'omar.hassan@example.ae', @pwd, 'Omar Hassan', '+971501234102', 'Abu Dhabi', 'Full-service design and project management for high-end residential and commercial.', 'https://i.pravatar.cc/150?u=omar102', 'Contemporary', '["Commercial","Residential","Hospitality"]', 0, 1, 'pending', 0, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY)),
(103, 'layla.mahmoud@example.ae', @pwd, 'Layla Mahmoud', '+971501234103', 'Sharjah', 'Soft furnishings and color consultancy. Creating warm, livable spaces.', 'https://i.pravatar.cc/150?u=layla103', 'Scandinavian', '["Soft Decoration","Residential"]', 0, 1, 'pending', 0, NULL, NOW()),
(104, 'youssef.ali@example.ae', @pwd, 'Youssef Ali', '+971501234104', 'Dubai', 'Award-winning designer focused on sustainable and smart home integration.', 'https://i.pravatar.cc/150?u=youssef104', 'Contemporary', '["Residential","Smart Home","Sustainable"]', 1, 1, 'approved', 1, NULL, DATE_SUB(NOW(), INTERVAL 30 DAY)),
(105, 'nadia.khalil@example.ae', @pwd, 'Nadia Khalil', '+971501234105', 'Dubai', 'Luxury villas and penthouses. Expert in marble, stone and bespoke joinery.', 'https://i.pravatar.cc/150?u=nadia105', 'Luxury', '["Villa","Penthouse","Luxury"]', 1, 1, 'approved', 2, NULL, DATE_SUB(NOW(), INTERVAL 28 DAY)),
(106, 'karim.farid@example.ae', @pwd, 'Karim Farid', '+971501234106', 'Abu Dhabi', 'Commercial and hospitality interiors. Hotels, offices, F&B.', 'https://i.pravatar.cc/150?u=karim106', 'Industrial', '["Commercial","Hospitality","F&B"]', 1, 1, 'approved', 3, NULL, DATE_SUB(NOW(), INTERVAL 21 DAY)),
(107, 'dina.salem@example.ae', @pwd, 'Dina Salem', '+971501234107', 'Dubai', 'Residential specialist. Turnkey design and procurement for apartments and townhouses.', 'https://i.pravatar.cc/150?u=dina107', 'Minimalist', '["Residential","Apartments","Turnkey"]', 1, 1, 'approved', 4, NULL, DATE_SUB(NOW(), INTERVAL 14 DAY)),
(108, 'tariq.ibrahim@example.ae', @pwd, 'Tariq Ibrahim', '+971501234108', 'Ras Al Khaimah', 'Coastal and resort-style design. Outdoor living and landscape integration.', 'https://i.pravatar.cc/150?u=tariq108', 'Coastal', '["Residential","Villa","Outdoor"]', 1, 1, 'approved', 5, NULL, DATE_SUB(NOW(), INTERVAL 10 DAY)),
(109, 'maya.rizk@example.ae', @pwd, 'Maya Rizk', '+971501234109', 'Dubai', 'Contemporary and transitional interiors. Family homes and duplexes.', 'https://i.pravatar.cc/150?u=maya109', 'Transitional', '["Residential","Family Homes"]', 1, 1, 'approved', 6, NULL, DATE_SUB(NOW(), INTERVAL 7 DAY)),
(110, 'hassan.mostafa@example.ae', @pwd, 'Hassan Mostafa', '+971501234110', 'Ajman', 'Budget-friendly design and space planning. Apartments and studios.', 'https://i.pravatar.cc/150?u=hassan110', 'Modern', '["Residential","Apartments","Budget"]', 1, 1, 'approved', 7, NULL, DATE_SUB(NOW(), INTERVAL 5 DAY)),
(111, 'reem.ghazi@example.ae', @pwd, 'Reem Ghazi', '+971501234111', 'Dubai', 'Applying for designer platform.', 'https://i.pravatar.cc/150?u=reem111', NULL, NULL, 0, 1, 'rejected', 0, 'Portfolio and experience did not meet current quality standards. You may reapply with more completed projects.', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(112, 'faisal.nour@example.ae', @pwd, 'Faisal Nour', '+971501234112', 'Fujairah', 'Interested in joining.', NULL, NULL, NULL, 0, 1, 'rejected', 0, 'Incomplete profile and missing verification documents.', DATE_SUB(NOW(), INTERVAL 3 DAY));

-- Projects for approved designers (104-110)
INSERT INTO projects (designer_id, title, description, style, location, area, year, cost, images, tags, status) VALUES
(104, 'Marina Heights Apartment', 'Full renovation and soft furnishing for a 3BR apartment with sea view.', 'Contemporary', 'Dubai Marina', '180 sqm', '2024', 'AED 320,000', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800","https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800"]', '["Residential","Renovation"]', 'published'),
(104, 'Arabian Ranches Villa', 'Villa interior design and landscaping concept.', 'Modern Arabic', 'Arabian Ranches, Dubai', '450 sqm', '2024', 'AED 850,000', '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800"]', '["Villa","Luxury"]', 'published'),
(105, 'Palm Jumeirah Penthouse', 'Luxury penthouse with panoramic views. Marble and custom millwork.', 'Luxury', 'Palm Jumeirah', '520 sqm', '2024', 'AED 1.2M', '["https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800"]', '["Penthouse","Luxury"]', 'published'),
(106, 'Downtown Office Suite', 'Corporate office design for a tech company. Collaborative and private zones.', 'Industrial', 'Downtown Dubai', '320 sqm', '2023', 'AED 280,000', '["https://images.unsplash.com/photo-1600566753190-17f0baa2eec6?w=800"]', '["Commercial","Office"]', 'published'),
(107, 'JVC Townhouse', 'Family townhouse with playroom and home office.', 'Minimalist', 'JVC, Dubai', '260 sqm', '2024', 'AED 195,000', '["https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800"]', '["Residential","Family"]', 'published'),
(108, 'Al Hamra Beach Villa', 'Coastal villa with pool and outdoor kitchen.', 'Coastal', 'Ras Al Khaimah', '380 sqm', '2024', 'AED 620,000', '["https://images.unsplash.com/photo-1600573472591-ee6c563aaec8?w=800"]', '["Villa","Coastal"]', 'published'),
(109, 'Damac Hills Duplex', 'Transitional duplex with neutral palette and textured finishes.', 'Transitional', 'Damac Hills', '340 sqm', '2024', 'AED 410,000', '["https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800"]', '["Residential","Duplex"]', 'published'),
(110, 'Studio Apartment JLT', 'Compact studio with smart storage and multifunctional furniture.', 'Modern', 'JLT, Dubai', '55 sqm', '2024', 'AED 45,000', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800"]', '["Studio","Budget"]', 'published');

-- Designer stats for last 7 days (approved designers only)
DELETE FROM designer_stats WHERE designer_id IN (104,105,106,107,108,109,110);
INSERT INTO designer_stats (designer_id, stat_date, profile_views, project_views, contact_clicks, phone_clicks, whatsapp_clicks) VALUES
(104, DATE_SUB(CURDATE(), INTERVAL 6 DAY), 42, 18, 5, 3, 8),
(104, DATE_SUB(CURDATE(), INTERVAL 5 DAY), 38, 22, 4, 2, 6),
(104, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 55, 30, 7, 4, 9),
(104, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 48, 25, 6, 3, 7),
(104, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 62, 28, 8, 5, 10),
(104, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 71, 35, 9, 4, 12),
(104, CURDATE(), 28, 12, 3, 2, 4),
(105, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 90, 45, 12, 6, 15),
(105, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 85, 42, 11, 5, 14),
(105, CURDATE(), 35, 18, 4, 2, 6),
(106, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 22, 10, 2, 1, 3),
(106, CURDATE(), 15, 8, 1, 1, 2),
(107, CURDATE(), 44, 20, 5, 3, 7),
(108, CURDATE(), 19, 9, 2, 1, 4),
(109, CURDATE(), 31, 14, 3, 2, 5),
(110, CURDATE(), 12, 6, 1, 0, 2);

-- Activity logs (assume admin_id 1 exists - super admin)
INSERT INTO admin_activity_logs (admin_id, action, target_type, target_id, details, created_at) VALUES
(1, 'login', 'admin', 1, NULL, DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(1, 'approve_designer', 'designer', 110, '{"name":"Hassan Mostafa","email":"hassan.mostafa@example.ae"}', DATE_SUB(NOW(), INTERVAL 5 HOUR)),
(1, 'reject_designer', 'designer', 112, '{"reason":"Incomplete profile and missing verification documents."}', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(1, 'reject_designer', 'designer', 111, '{"reason":"Portfolio and experience did not meet current quality standards."}', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(1, 'approve_designer', 'designer', 109, '{"name":"Maya Rizk","email":"maya.rizk@example.ae"}', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(1, 'update_designer_order', 'designer', NULL, '{"count":7}', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(1, 'login', 'admin', 1, NULL, DATE_SUB(NOW(), INTERVAL 5 DAY));

SELECT 'Seed completed. Designers 101-112, projects, stats and activity logs added.' AS message;
