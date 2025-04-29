import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import PropertyForm from '../components/properties/PropertyForm';
import { Property } from '../types';
import { useProperty } from '../contexts/PropertyContext';
import { propertyService } from '../services/supabase';
import { Plus, Search, Building2, MapPin, Phone, Mail, Edit, Trash, Loader2 } from 'lucide-react';

const Properties: React.FC = () => {
  const navigate = useNavigate();
  const { properties: contextProperties, setSelectedProperty } = useProperty();
  const [properties, setProperties] = useState<Property[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await propertyService.getAll();
      setProperties(data);
    } catch (err) {
      console.error('Error loading properties:', err);
      setError('Failed to load properties. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProperties = properties.filter(property =>
    property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    property.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddProperty = () => {
    setEditingProperty(undefined);
    setShowForm(true);
  };

  const handleEditProperty = (property: Property) => {
    setEditingProperty(property);
    setShowForm(true);
  };

  const handleDeleteProperty = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus properti ini?')) {
      try {
        setIsLoading(true);
        await propertyService.delete(id);
        await loadProperties();
        
        // Update selected property if needed
        const updatedProperties = properties.filter(property => property.id !== id);
        if (updatedProperties.length > 0) {
          setSelectedProperty(updatedProperties[0]);
        } else {
          setSelectedProperty(null);
        }
      } catch (err) {
        setError('Gagal menghapus properti. Silakan coba lagi.');
        console.error('Error deleting property:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleFormSubmit = async (data: Partial<Property>) => {
    try {
      setIsLoading(true);
      setError(null);

      let property: Property;
      if (editingProperty) {
        // Update existing property
        property = await propertyService.update(editingProperty.id, data);
      } else {
        // Create new property
        property = await propertyService.create(data);
      }

      await loadProperties();
      setSelectedProperty(property);
      setShowForm(false);
      setEditingProperty(undefined);
      navigate('/dashboard');
    } catch (err) {
      setError('Gagal menyimpan properti. Silakan coba lagi.');
      console.error('Error saving property:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProperty = (property: Property) => {
    setSelectedProperty(property);
    navigate('/dashboard');
  };

  if (isLoading && properties.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="mt-2 text-gray-600">Memuat properti...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Properti</h1>
        <Button 
          icon={<Plus size={16} />} 
          onClick={handleAddProperty}
          disabled={isLoading}
        >
          Tambah Properti
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-800">Daftar Properti</h2>
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Cari properti..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading && properties.length > 0 ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
              <p className="mt-2 text-gray-500">Memperbarui data...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProperties.length > 0 ? (
                filteredProperties.map((property) => (
                  <div
                    key={property.id}
                    className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleSelectProperty(property)}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <Building2 size={24} className="text-blue-600 mr-3" />
                          <h3 className="text-lg font-semibold text-gray-900">{property.name}</h3>
                        </div>
                      </div>

                      <div className="space-y-3 text-sm">
                        <div className="flex items-start">
                          <MapPin size={16} className="text-gray-400 mt-1 mr-2" />
                          <div>
                            <p className="text-gray-600">{property.address}</p>
                            <p className="text-gray-600">{property.city}</p>
                          </div>
                        </div>

                        <div className="flex items-center">
                          <Phone size={16} className="text-gray-400 mr-2" />
                          <p className="text-gray-600">{property.phone}</p>
                        </div>

                        <div className="flex items-center">
                          <Mail size={16} className="text-gray-400 mr-2" />
                          <p className="text-gray-600">{property.email}</p>
                        </div>
                      </div>

                      <div className="mt-6 flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Edit size={14} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditProperty(property);
                          }}
                          disabled={isLoading}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<Trash size={14} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProperty(property.id);
                          }}
                          disabled={isLoading}
                        >
                          Hapus
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-gray-500">
                  {searchQuery
                    ? 'Tidak ada properti yang sesuai dengan pencarian Anda.'
                    : 'Belum ada properti yang ditambahkan. Klik "Tambah Properti" untuk mulai.'}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <PropertyForm
          property={editingProperty}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingProperty(undefined);
            setError(null);
          }}
        />
      )}
    </div>
  );
};

export default Properties;