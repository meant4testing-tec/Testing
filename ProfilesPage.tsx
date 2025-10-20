import React, { useState } from 'react';
import { Profile } from '../types';
import { db } from '../services/db';
import { cancelAllNotificationsForMedicine } from '../services/notificationManager';
import ProfileForm from './ProfileForm';

interface ProfilesPageProps {
    profiles: Profile[];
    selectedProfile: Profile | null;
    onProfileSelect: (profile: Profile) => void;
    onProfilesUpdate: (profileIdToSelect?: string) => void;
}

const calculateAge = (dob: string): string => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
        years--;
        months += 12;
    }
    return `${years}y ${months}m`;
};

const ProfilesPage: React.FC<ProfilesPageProps> = ({ profiles, selectedProfile, onProfileSelect, onProfilesUpdate }) => {
    const [mode, setMode] = useState<'view' | 'add' | 'edit'>('view');
    const [profileToEdit, setProfileToEdit] = useState<Profile | null>(null);
    
    const handleSaveProfile = async (profile: Profile) => {
        if (mode === 'add') {
            await db.profiles.add(profile);
        } else {
            await db.profiles.update(profile);
        }
        onProfilesUpdate(profile.id);
        setMode('view');
        setProfileToEdit(null);
    };

    const handleDeleteProfile = async (profileId: string) => {
        if (window.confirm("Are you sure you want to delete this profile and all their medication data? This action cannot be undone.")) {
            try {
                const medsToDelete = await db.medicines.getByProfileId(profileId);
                for(const med of medsToDelete) {
                    // Cancel all notifications for this medicine before deleting data
                    await cancelAllNotificationsForMedicine(med.id);

                    const schedulesToDelete = await db.schedules.getByMedicineId(med.id);
                    for(const schedule of schedulesToDelete) {
                        await db.schedules.delete(schedule.id);
                    }
                    await db.medicines.delete(med.id);
                }
                await db.profiles.delete(profileId);
                onProfilesUpdate();
            } catch(e) {
                console.error("Failed to delete profile", e);
                alert("An error occurred while deleting the profile.");
            }
        }
    };

    const handleEdit = (profile: Profile) => {
        setProfileToEdit(profile);
        setMode('edit');
    };
    
    const EditIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>);
    const DeleteIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>);

    const renderViewMode = () => (
        <>
            <h1 className="text-3xl font-bold mb-1">Manage Profiles</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Select a profile to view their schedule, or add a new one.</p>
            <div className="space-y-3">
                {profiles.map(profile => (
                    <div
                        key={profile.id}
                        className={`p-3 rounded-lg flex items-center justify-between transition-all cursor-pointer border-2 ${selectedProfile?.id === profile.id ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500' : 'bg-gray-100 dark:bg-gray-800 border-transparent hover:border-primary-300'}`}
                        onClick={() => onProfileSelect(profile)}
                    >
                        <div className="flex items-center overflow-hidden">
                            <img src={profile.picture} alt={profile.name} className="w-12 h-12 rounded-full object-cover mr-4 flex-shrink-0" />
                            <div className="truncate">
                                <span className="font-medium block truncate text-lg">{profile.name}</span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">{calculateAge(profile.dob)} old</span>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(profile); }} className="p-2 rounded-full text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50" aria-label={`Edit ${profile.name}`}><EditIcon /></button>
                            {profiles.length > 1 && <button onClick={(e) => { e.stopPropagation(); handleDeleteProfile(profile.id); }} className="p-2 rounded-full text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50" aria-label={`Delete ${profile.name}`}><DeleteIcon /></button>}
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={() => setMode('add')} className="w-full mt-6 py-3 px-4 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                <span>Add New Profile</span>
            </button>
        </>
    );

    const renderEditMode = () => (
        <div>
             <h1 className="text-3xl font-bold mb-6">{profileToEdit ? 'Edit Profile' : 'Add New Profile'}</h1>
             <ProfileForm 
                existingProfile={profileToEdit} 
                onSave={handleSaveProfile} 
                onCancel={() => { setMode('view'); setProfileToEdit(null); }} 
            />
        </div>
    );

    return (
        <div>
            {mode === 'view' ? renderViewMode() : renderEditMode()}
        </div>
    );
};

export default ProfilesPage;