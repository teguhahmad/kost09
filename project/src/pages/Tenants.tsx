import React, { useState, useEffect } from 'react';
import TenantsList from '../components/tenants/TenantsList';
import TenantForm from '../components/tenants/TenantForm';
import { Tenant, Room } from '../types';
import { tenantService, roomService } from '../services/supabase';
import { useProperty } from '../contexts/PropertyContext';
import { Loader2 } from 'lucide-react';

const Tenants: React.FC = () => {
  const { selectedProperty } = useProperty();
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!selectedProperty) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Load both tenants and rooms
      const [tenantsData, roomsData] = await Promise.all([
        tenantService.getByPropertyId(selectedProperty.id),
        roomService.getByPropertyId(selectedProperty.id)
      ]);
      
      setAllTenants(tenantsData);
      setRooms(roomsData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Gagal memuat data. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProperty]);

  const handleAddTenant = () => {
    setEditingTenant(undefined);
    setShowForm(true);
  };

  const handleEditTenant = (id: string) => {
    const tenant = allTenants.find(t => t.id === id);
    setEditingTenant(tenant);
    setShowForm(true);
  };

  const handleDeleteTenant = async (id: string) => {
    if (!selectedProperty) return;
    
    if (confirm('Apakah Anda yakin ingin menghapus penyewa ini?')) {
      try {
        setIsLoading(true);
        await tenantService.delete(id);
        await loadData();
      } catch (err) {
        console.error('Error deleting tenant:', err);
        setError('Gagal menghapus penyewa. Silakan coba lagi.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleFormSubmit = async (data: Partial<Tenant>) => {
    if (!selectedProperty) return;

    try {
      setIsLoading(true);
      setError(null);

      if (editingTenant) {
        await tenantService.update(editingTenant.id, {
          ...data,
          property_id: selectedProperty.id
        });
      } else {
        await tenantService.create({
          ...data as Omit<Tenant, 'id' | 'created_at' | 'updated_at'>,
          property_id: selectedProperty.id
        });
      }

      await loadData();
      setShowForm(false);
      setEditingTenant(undefined);
    } catch (err) {
      console.error('Error saving tenant:', err);
      setError('Gagal menyimpan data penyewa. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && allTenants.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="mt-2 text-gray-600">Memuat data penyewa...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Penyewa</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      <TenantsList
        tenants={allTenants}
        rooms={rooms}
        onAddTenant={handleAddTenant}
        onEditTenant={handleEditTenant}
        onDeleteTenant={handleDeleteTenant}
        isLoading={isLoading}
      />

      {showForm && (
        <TenantForm
          tenant={editingTenant}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingTenant(undefined);
            setError(null);
          }}
        />
      )}
    </div>
  );
};

export default Tenants;