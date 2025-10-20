import React, { useState, useRef, ChangeEvent } from 'react';
import { Profile } from '../types';
import { compressImage } from '../services/imageCompressor';

interface ProfileFormProps {
    onSave: (profile: Profile) => void;
    onCancel: () => void;
    existingProfile?: Profile | null;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ onSave, onCancel, existingProfile }) => {
    const [name, setName] = useState(existingProfile?.name || '');
    const [picture, setPicture] = useState<string | null>(existingProfile?.picture || null);
    const [dob, setDob] = useState(existingProfile?.dob || '');
    const [wakeTime, setWakeTime] = useState(existingProfile?.wakeTime || '07:00');
    const [sleepTime, setSleepTime] = useState(existingProfile?.sleepTime || '22:00');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const compressedImage = await compressImage(e.target.files[0]);
                setPicture(compressedImage);
            } catch (error) {
                console.error("Error compressing image:", error);
                alert("Failed to process image. Please try another one.");
            }
        }
    };

    const handleSubmit = () => {
        if (!name.trim() || !dob) {
            alert("Please enter a name and date of birth.");
            return;
        }
        const profileData: Profile = {
            id: existingProfile?.id || crypto.randomUUID(),
            name: name.trim(),
            picture: picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=dbeafe&color=1d4ed8&bold=true`,
            dob,
            wakeTime,
            sleepTime,
        };
        onSave(profileData);
    };

    return (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
            <h3 className="font-semibold text-lg">{existingProfile ? `Editing ${existingProfile.name}` : 'Add New Profile'}</h3>
            <div className="flex items-center space-x-4">
                <img src={picture || 'https://ui-avatars.com/api/?name=?'} alt="Profile preview" className="w-20 h-20 rounded-full object-cover bg-gray-200 dark:bg-gray-600" />
                <div className="flex-grow">
                    <label className="text-sm font-medium">Profile Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., John Doe"
                        className="mt-1 w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                     <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full mt-2 px-3 py-2 text-sm text-center bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md"
                    >
                        {picture ? 'Change Picture' : 'Upload Picture'}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                </div>
            </div>
             <div>
                <label className="text-sm font-medium">Date of Birth</label>
                <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-sm font-medium">Wake-up Time</label>
                    <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                </div>
                <div>
                    <label className="text-sm font-medium">Sleep Time</label>
                    <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)} className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
                <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
                <button onClick={handleSubmit} className="px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-md font-semibold">Save Profile</button>
            </div>
        </div>
    );
};

export default ProfileForm;
