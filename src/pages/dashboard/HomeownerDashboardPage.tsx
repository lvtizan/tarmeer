import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  MapPin,
  Phone,
  Ruler,
  DollarSign,
  FileText,
  User,
  ArrowRight,
  Pencil,
  Check,
} from 'lucide-react';
import { api } from '../../lib/api';

interface HomeownerProfile {
  id: string;
  areaRange: string;
  city: string;
  address: string;
  phone: string;
  stage?: string;
  budget?: string;
  notes?: string;
}

interface DesignerInfo {
  id: string;
  name: string;
  title: string;
  city: string;
  bio: string;
  avatar: string;
  rating?: number;
  recentProjects?: Array<{
    id: string;
    image: string;
    title: string;
  }>;
  contactPhone?: string;
  contactEmail?: string;
}

const AREA_OPTIONS = ['<50m²', '50-100m²', '100-200m²', '200-500m²', '>500m²'];
const CITY_OPTIONS = [
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Ras Al Khaimah',
  'Fujairah',
  'Umm Al Quwain',
];
const STAGE_OPTIONS = ['Researching', 'Has Design', 'Ready to Start', 'In Progress'];
const BUDGET_OPTIONS = ['<50K', '50-100K', '100-300K', '300K-1M', '>1M AED'];

export default function HomeownerDashboardPage() {
  const [profile, setProfile] = useState<HomeownerProfile | null>(null);
  const [designer, setDesigner] = useState<DesignerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<HomeownerProfile>>({
    areaRange: '',
    city: '',
    address: '',
    phone: '',
    stage: '',
    budget: '',
    notes: '',
  });

  useEffect(() => {
    fetchProfile();
    fetchDesigner();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/auth/homeowner/profile');
      setProfile(response.data);
      setFormData({
        areaRange: response.data.areaRange || '',
        city: response.data.city || '',
        address: response.data.address || '',
        phone: response.data.phone || '',
        stage: response.data.stage || '',
        budget: response.data.budget || '',
        notes: response.data.notes || '',
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const fetchDesigner = async () => {
    try {
      const response = await api.get('/auth/homeowner/assigned-designer');
      setDesigner(response.data);
    } catch (error) {
      console.error('Failed to fetch designer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!formData.areaRange || !formData.city || !formData.address || !formData.phone) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const response = await api.post('/auth/homeowner/profile', formData);
      setProfile(response.data);
      setEditMode(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleChip = (field: keyof HomeownerProfile, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field] === value ? '' : value,
    }));
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-stone-600"
        >
          <Home size={48} />
        </motion.div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900 mb-8">
        Welcome to Your Renovation Journey
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section A - My Renovation Requirements */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {!profile && !editMode ? (
              <EmptyStateCard onFill={() => setEditMode(true)} />
            ) : editMode ? (
              <EditProfileCard
                formData={formData}
                setFormData={setFormData}
                toggleChip={toggleChip}
                onSave={handleSaveProfile}
                onCancel={() => {
                  setEditMode(false);
                  if (profile) {
                    setFormData({
                      areaRange: profile.areaRange,
                      city: profile.city,
                      address: profile.address,
                      phone: profile.phone,
                      stage: profile.stage,
                      budget: profile.budget,
                      notes: profile.notes,
                    });
                  }
                }}
                saving={saving}
              />
            ) : (
              <ProfileCard profile={profile!} onEdit={() => setEditMode(true)} />
            )}
          </motion.div>

          {/* Section B - Assigned Designer */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            {designer ? (
              <DesignerCard designer={designer} />
            ) : (
              <MatchingPlaceholder />
            )}
          </motion.div>
        </div>
    </div>
  );
}

function EmptyStateCard({ onFill }: { onFill: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl border border-stone-200/50 p-8 min-h-96 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition-shadow"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="mb-6"
      >
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
          <FileText size={32} className="text-amber-700" />
        </div>
      </motion.div>
      <h2 className="text-xl font-semibold text-stone-900 mb-2">
        My Renovation Requirements
      </h2>
      <p className="text-stone-600 mb-8 max-w-xs">
        Tell us about your project so we can match you with the perfect designer
      </p>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onFill}
        className="inline-flex items-center gap-2 px-6 py-3 bg-amber-700 text-white font-medium rounded-lg hover:bg-amber-800 transition-colors shadow-md hover:shadow-lg"
      >
        Fill Requirements
        <ArrowRight size={18} />
      </motion.button>
    </motion.div>
  );
}

function ProfileCard({
  profile,
  onEdit,
}: {
  profile: HomeownerProfile;
  onEdit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl border border-stone-200/50 p-8 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-6">
        <h2 className="text-xl font-semibold text-stone-900">My Renovation Requirements</h2>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onEdit}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
        >
          <Pencil size={20} className="text-stone-600" />
        </motion.button>
      </div>

      <div className="space-y-6">
        {/* Area & City Row */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
              <Ruler size={16} />
              Area
            </label>
            <p className="text-stone-900 font-medium">{profile.areaRange}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
              <MapPin size={16} />
              City
            </label>
            <p className="text-stone-900 font-medium">{profile.city}</p>
          </div>
        </div>

        {/* Address & Phone Row */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Address</label>
            <p className="text-stone-900 text-sm">{profile.address}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
              <Phone size={16} />
              Phone
            </label>
            <p className="text-stone-900 font-medium">{profile.phone}</p>
          </div>
        </div>

        {/* Stage & Budget Row */}
        {(profile.stage || profile.budget) && (
          <div className="grid grid-cols-2 gap-6">
            {profile.stage && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Stage</label>
                <span className="inline-block px-3 py-1 bg-amber-50 text-amber-900 text-sm font-medium rounded-full border border-amber-200">
                  {profile.stage}
                </span>
              </div>
            )}
            {profile.budget && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                  <DollarSign size={16} />
                  Budget
                </label>
                <span className="inline-block px-3 py-1 bg-amber-50 text-amber-900 text-sm font-medium rounded-full border border-amber-200">
                  {profile.budget}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {profile.notes && (
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Notes</label>
            <p className="text-stone-600 text-sm bg-stone-50 p-3 rounded-lg">{profile.notes}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function EditProfileCard({
  formData,
  setFormData,
  toggleChip,
  onSave,
  onCancel,
  saving,
}: {
  formData: Partial<HomeownerProfile>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<HomeownerProfile>>>;
  toggleChip: (field: keyof HomeownerProfile, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl border border-stone-200/50 p-8 shadow-sm"
    >
      <h2 className="text-xl font-semibold text-stone-900 mb-8">Edit Renovation Requirements</h2>

      <div className="space-y-8">
        {/* Area Range */}
        <div>
          <label className="block text-sm font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Ruler size={16} />
            Property Area *
          </label>
          <div className="flex flex-wrap gap-2">
            {AREA_OPTIONS.map((option) => (
              <motion.button
                key={option}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleChip('areaRange', option)}
                className={`px-4 py-2 rounded-full font-medium transition-all border ${
                  formData.areaRange === option
                    ? 'bg-amber-700 text-white border-amber-700'
                    : 'bg-white text-stone-700 border-stone-300 hover:border-amber-700'
                }`}
              >
                {option}
              </motion.button>
            ))}
          </div>
        </div>

        {/* City */}
        <div>
          <label className="block text-sm font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <MapPin size={16} />
            City *
          </label>
          <select
            value={formData.city || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
            className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent"
          >
            <option value="">Select a city</option>
            {CITY_OPTIONS.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-semibold text-stone-900 mb-4">Address *</label>
          <input
            type="text"
            value={formData.address || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="Enter your property address"
            className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Phone size={16} />
            Phone *
          </label>
          <div className="flex">
            <span className="inline-flex items-center px-4 bg-stone-100 border border-r-0 border-stone-300 rounded-l-lg text-stone-700 font-medium">
              +971
            </span>
            <input
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="50 1234567"
              className="flex-1 px-4 py-3 bg-white border border-stone-300 rounded-r-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent"
            />
          </div>
        </div>

        {/* Stage */}
        <div>
          <label className="block text-sm font-semibold text-stone-900 mb-4">
            Project Stage (Optional)
          </label>
          <div className="flex flex-wrap gap-2">
            {STAGE_OPTIONS.map((option) => (
              <motion.button
                key={option}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleChip('stage', option)}
                className={`px-4 py-2 rounded-full font-medium transition-all border ${
                  formData.stage === option
                    ? 'bg-amber-700 text-white border-amber-700'
                    : 'bg-white text-stone-700 border-stone-300 hover:border-amber-700'
                }`}
              >
                {option}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="block text-sm font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <DollarSign size={16} />
            Budget (Optional)
          </label>
          <div className="flex flex-wrap gap-2">
            {BUDGET_OPTIONS.map((option) => (
              <motion.button
                key={option}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleChip('budget', option)}
                className={`px-4 py-2 rounded-full font-medium transition-all border ${
                  formData.budget === option
                    ? 'bg-amber-700 text-white border-amber-700'
                    : 'bg-white text-stone-700 border-stone-300 hover:border-amber-700'
                }`}
              >
                {option}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-stone-900 mb-4">
            Notes (Optional)
          </label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Tell us more about your vision, style preferences, or specific requirements..."
            rows={4}
            className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent resize-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-8">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-700 text-white font-medium rounded-lg hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg"
        >
          <Check size={20} />
          {saving ? 'Saving...' : 'Save Changes'}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onCancel}
          disabled={saving}
          className="flex-1 px-6 py-3 bg-stone-100 text-stone-900 font-medium rounded-lg hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </motion.button>
      </div>
    </motion.div>
  );
}

function DesignerCard({ designer }: { designer: DesignerInfo }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl border border-stone-200/50 p-8 shadow-sm hover:shadow-md transition-shadow"
    >
      <h2 className="text-xl font-semibold text-stone-900 mb-6">Your Assigned Designer</h2>

      {/* Designer Avatar & Info */}
      <div className="flex gap-6 mb-8 pb-8 border-b border-stone-200/50">
        <motion.img
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          src={designer.avatar}
          alt={designer.name}
          className="w-20 h-20 rounded-full object-cover ring-2 ring-amber-200"
        />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-stone-900">{designer.name}</h3>
          <p className="text-stone-600 text-sm mb-1">{designer.title}</p>
          <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
            <MapPin size={14} />
            {designer.city}
          </div>
          {designer.rating && (
            <div className="flex items-center gap-1 mt-2">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <span key={i}>{i < Math.round(designer.rating!) ? '★' : '☆'}</span>
                ))}
              </div>
              <span className="text-xs text-stone-600">({designer.rating})</span>
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      {designer.bio && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <p className="text-stone-700 text-sm leading-relaxed">{designer.bio}</p>
        </motion.div>
      )}

      {/* Recent Projects */}
      {designer.recentProjects && designer.recentProjects.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <h4 className="text-sm font-semibold text-stone-900 mb-3">Recent Projects</h4>
          <div className="grid grid-cols-3 gap-3">
            {designer.recentProjects.slice(0, 3).map((project) => (
              <motion.div
                key={project.id}
                whileHover={{ scale: 1.05 }}
                className="aspect-square rounded-lg overflow-hidden border border-stone-200/50 cursor-pointer"
              >
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover hover:brightness-110 transition-all"
                  title={project.title}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Contact Info */}
      {(designer.contactPhone || designer.contactEmail) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="space-y-3 pt-6 border-t border-stone-200/50"
        >
          {designer.contactPhone && (
            <a
              href={`tel:${designer.contactPhone}`}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors group"
            >
              <Phone size={18} className="text-amber-700" />
              <span className="text-sm font-medium text-amber-900 group-hover:text-amber-950">
                {designer.contactPhone}
              </span>
            </a>
          )}
          {designer.contactEmail && (
            <a
              href={`mailto:${designer.contactEmail}`}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors group"
            >
              <FileText size={18} className="text-amber-700" />
              <span className="text-sm font-medium text-amber-900 group-hover:text-amber-950 truncate">
                {designer.contactEmail}
              </span>
            </a>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function MatchingPlaceholder() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl border border-stone-200/50 p-8 min-h-96 flex flex-col items-center justify-center text-center shadow-sm"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="mb-6"
      >
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
          <User size={32} className="text-amber-700" />
        </div>
      </motion.div>
      <h2 className="text-xl font-semibold text-stone-900 mb-2">Assigned Designer</h2>
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-stone-600 text-sm"
      >
        <p>We're matching you with the perfect designer...</p>
      </motion.div>
      <motion.div
        animate={{ scaleX: [0, 1, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="mt-6 h-1 w-24 bg-gradient-to-r from-transparent via-amber-700 to-transparent rounded-full"
      />
    </motion.div>
  );
}
