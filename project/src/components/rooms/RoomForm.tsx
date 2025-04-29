import React from 'react';
import { Room } from '../../types';
import Button from '../ui/Button';
import { X } from 'lucide-react';
import { useProperty } from '../../contexts/PropertyContext';

interface RoomFormProps {
  room?: Room;
  onSubmit: (data: Partial<Room>) => void;
  onClose: () => void;
}

const AVAILABLE_FACILITIES = [
  'AC',
  'Kamar Mandi',
  'Wifi',
  'TV',
  'Kulkas',
  'Tempat Tidur',
  'Meja',
  'Lemari',
  'Pemanas Air',
  'Dapur',
  'Parkir'
];

const RoomForm: React.FC<RoomFormProps> = ({ room, onSubmit, onClose }) => {
  const { selectedProperty } = useProperty();
  const [formData, setFormData] = React.useState<Partial<Room>>({
    number: room?.number || '',
    floor: room?.floor || '',
    type: room?.type || 'single',
    price: room?.price || 0,
    status: room?.status || 'vacant',
    facilities: room?.facilities || [],
    property_id: selectedProperty?.id
  });
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) {
      return; // Prevent multiple submissions
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (!selectedProperty) {
        throw new Error('No property selected');
      }

      // Submit the form data through the onSubmit prop
      await onSubmit({
        ...formData,
        property_id: selectedProperty.id
      });

      onClose();
    } catch (err) {
      console.error('Error saving room:', err);
      setError(err instanceof Error ? err.message : 'Failed to save room');
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'price') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    setError(null);
  };

  const handleFacilityChange = (facility: string) => {
    setFormData(prev => ({
      ...prev,
      facilities: prev.facilities?.includes(facility)
        ? prev.facilities.filter(f => f !== facility)
        : [...(prev.facilities || []), facility]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            {room ? 'Ubah Kamar' : 'Tambah Kamar Baru'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nomor Kamar
            </label>
            <input
              type="text"
              name="number"
              value={formData.number}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lantai
            </label>
            <input
              type="text"
              name="floor"
              value={formData.floor}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipe
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isSubmitting}
            >
              <option value="single">Single</option>
              <option value="double">Double</option>
              <option value="deluxe">Deluxe</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Harga (per bulan)
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              min="0"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isSubmitting}
            >
              <option value="vacant">Kosong</option>
              <option value="occupied">Terisi</option>
              <option value="maintenance">Perbaikan</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fasilitas
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_FACILITIES.map((facility) => (
                <label key={facility} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.facilities?.includes(facility)}
                    onChange={() => handleFacilityChange(facility)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm text-gray-700">{facility}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Menyimpan...' : room ? 'Simpan Perubahan' : 'Tambah Kamar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoomForm;