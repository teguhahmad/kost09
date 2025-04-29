import React, { useState, useEffect } from 'react';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import RoomForm from '../components/rooms/RoomForm';
import { Room, Tenant } from '../types';
import { formatCurrency, getRoomStatusColor } from '../utils/formatters';
import { Plus, Search, X, User, Loader2, Trash } from 'lucide-react';
import { useProperty } from '../contexts/PropertyContext';
import { supabase } from '../lib/supabase';

const Rooms: React.FC = () => {
  const { selectedProperty } = useProperty();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showTenantSelector, setShowTenantSelector] = useState(false);
  const [showTenantDetails, setShowTenantDetails] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | undefined>();
  const [selectedRoom, setSelectedRoom] = useState<Room | undefined>();
  const [selectedTenant, setSelectedTenant] = useState<Tenant | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRooms();
  }, [selectedProperty]);

  const loadRooms = async () => {
    if (!selectedProperty) return;

    try {
      setIsLoading(true);
      setError(null);

      // Load rooms with the status column now included
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('id, property_id, status, type, price, floor')
        .eq('property_id', selectedProperty.id)
        .order('id');

      if (roomsError) throw roomsError;
      setRooms(roomsData || []);

      // Load tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select('*')
        .eq('property_id', selectedProperty.id);

      if (tenantsError) throw tenantsError;
      setTenants(tenantsData || []);
    } catch (err) {
      console.error('Error loading rooms:', err);
      setError('Failed to load rooms');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRoom = async (room: Room) => {
    // Check if any tenants are assigned to this room
    const assignedTenants = tenants.filter(tenant => tenant.room_id === room.id);
    
    if (assignedTenants.length > 0) {
      const confirmMessage = `Kamar ini masih memiliki ${assignedTenants.length} penyewa terdaftar. Anda harus menghapus atau memindahkan penyewa terlebih dahulu sebelum menghapus kamar.`;
      alert(confirmMessage);
      return;
    }

    if (window.confirm('Apakah Anda yakin ingin menghapus kamar ini?')) {
      try {
        setIsLoading(true);
        setError(null);

        const { error: deleteError } = await supabase
          .from('rooms')
          .delete()
          .eq('id', room.id);

        if (deleteError) throw deleteError;

        await loadRooms();
      } catch (err) {
        console.error('Error deleting room:', err);
        setError('Failed to delete room');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.floor.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === 'all') return matchesSearch;
    return matchesSearch && room.status === filter;
  });

  const handleAddRoom = () => {
    setEditingRoom(undefined);
    setShowRoomForm(true);
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setShowRoomForm(true);
  };

  const handleRoomFormSubmit = async (data: Partial<Room>) => {
    try {
      setIsLoading(true);
      setError(null);

      // Remove facilities from the data object since it doesn't exist in the schema
      const { facilities, ...roomData } = data;

      if (editingRoom) {
        // Update existing room
        const { error: updateError } = await supabase
          .from('rooms')
          .update(roomData)
          .eq('id', editingRoom.id);

        if (updateError) throw updateError;
      } else {
        // Create new room with default status
        const { error: insertError } = await supabase
          .from('rooms')
          .insert([{ ...roomData, status: 'vacant' }]);

        if (insertError) throw insertError;
      }

      await loadRooms();
      setShowRoomForm(false);
      setEditingRoom(undefined);
    } catch (err) {
      console.error('Error saving room:', err);
      setError('Failed to save room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTenant = (room: Room) => {
    if (room.tenant_id) {
      const tenant = tenants.find(t => t.id === room.tenant_id);
      if (tenant) {
        setSelectedTenant(tenant);
        setSelectedRoom(room);
        setShowTenantDetails(true);
      }
    }
  };

  const handleAssignTenant = (room: Room) => {
    setSelectedRoom(room);
    setShowTenantSelector(true);
  };

  const handleTenantSelection = async (tenantId: string) => {
    if (selectedRoom) {
      try {
        setIsLoading(true);
        setError(null);

        // Update room status and tenant
        const { error: roomError } = await supabase
          .from('rooms')
          .update({
            status: 'occupied',
            tenant_id: tenantId
          })
          .eq('id', selectedRoom.id);

        if (roomError) throw roomError;

        // Update tenant's room assignment
        const { error: tenantError } = await supabase
          .from('tenants')
          .update({ room_id: selectedRoom.id })
          .eq('id', tenantId);

        if (tenantError) throw tenantError;

        await loadRooms();
        setShowTenantSelector(false);
        setSelectedRoom(undefined);
      } catch (err) {
        console.error('Error assigning tenant:', err);
        setError('Failed to assign tenant');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRemoveTenant = async (room: Room) => {
    if (room.tenant_id) {
      try {
        setIsLoading(true);
        setError(null);

        // Update room status
        const { error: roomError } = await supabase
          .from('rooms')
          .update({
            status: 'vacant',
            tenant_id: null
          })
          .eq('id', room.id);

        if (roomError) throw roomError;

        // Update tenant's room assignment
        const { error: tenantError } = await supabase
          .from('tenants')
          .update({ room_id: null })
          .eq('id', room.tenant_id);

        if (tenantError) throw tenantError;

        await loadRooms();
        setShowTenantDetails(false);
        setSelectedTenant(undefined);
        setSelectedRoom(undefined);
      } catch (err) {
        console.error('Error removing tenant:', err);
        setError('Failed to remove tenant');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getRoomTypeLabel = (type: string): string => {
    switch (type) {
      case 'single':
        return 'Kamar Single';
      case 'double':
        return 'Kamar Double';
      case 'deluxe':
        return 'Kamar Deluxe';
      default:
        return type;
    }
  };

  if (isLoading && rooms.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="mt-2 text-gray-600">Memuat data kamar...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Kamar</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}
      
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-800">Manajemen Kamar</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Cari kamar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
            </div>
            <Button 
              icon={<Plus size={16} />} 
              onClick={handleAddRoom}
              disabled={isLoading}
            >
              Tambah Kamar
            </Button>
          </div>
        </CardHeader>

        <div className="px-6 pb-2 flex flex-wrap gap-2">
          <Button 
            variant={filter === 'all' ? 'primary' : 'outline'} 
            size="sm" 
            onClick={() => setFilter('all')}
          >
            Semua
          </Button>
          <Button 
            variant={filter === 'occupied' ? 'primary' : 'outline'} 
            size="sm" 
            onClick={() => setFilter('occupied')}
          >
            Terisi
          </Button>
          <Button 
            variant={filter === 'vacant' ? 'primary' : 'outline'} 
            size="sm" 
            onClick={() => setFilter('vacant')}
          >
            Kosong
          </Button>
          <Button 
            variant={filter === 'maintenance' ? 'primary' : 'outline'} 
            size="sm" 
            onClick={() => setFilter('maintenance')}
          >
            Perbaikan
          </Button>
        </div>
        
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredRooms.map((room) => (
              <div 
                key={room.id} 
                className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                <div 
                  className={`h-2 ${
                    room.status === 'occupied' 
                      ? 'bg-blue-500' 
                      : room.status === 'vacant' 
                        ? 'bg-green-500' 
                        : 'bg-yellow-500'
                  }`}
                />
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">Kamar {room.id}</h3>
                      <p className="text-sm text-gray-500">Lantai {room.floor}</p>
                    </div>
                    <Badge className={getRoomStatusColor(room.status)}>
                      {room.status === 'occupied' ? 'Terisi' : 
                       room.status === 'vacant' ? 'Kosong' : 'Perbaikan'}
                    </Badge>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-gray-600">{getRoomTypeLabel(room.type)}</p>
                    <p className="text-lg font-semibold text-blue-600">{formatCurrency(room.price)}/bulan</p>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEditRoom(room)}
                        disabled={isLoading}
                      >
                        Ubah
                      </Button>
                      {room.status === 'occupied' ? (
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => handleViewTenant(room)}
                          disabled={isLoading}
                        >
                          Detail Penyewa
                        </Button>
                      ) : room.status === 'vacant' ? (
                        <Button 
                          variant="primary" 
                          size="sm"
                          onClick={() => handleAssignTenant(room)}
                          disabled={isLoading}
                        >
                          Tambah Penyewa
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled
                        >
                          Dalam Perbaikan
                        </Button>
                      )}
                    </div>
                    {room.status === 'vacant' && (
                      <Button
                        variant="danger"
                        size="sm"
                        className="w-full"
                        onClick={() => handleDeleteRoom(room)}
                        disabled={isLoading}
                        icon={<Trash size={14} />}
                      >
                        Hapus Kamar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {showRoomForm && (
        <RoomForm
          room={editingRoom}
          onSubmit={handleRoomFormSubmit}
          onClose={() => {
            setShowRoomForm(false);
            setEditingRoom(undefined);
            setError(null);
          }}
        />
      )}

      {/* Tenant Details Modal */}
      {showTenantDetails && selectedTenant && selectedRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Detail Penyewa</h2>
              <button 
                onClick={() => {
                  setShowTenantDetails(false);
                  setSelectedTenant(undefined);
                  setSelectedRoom(undefined);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-center mb-6">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                  <User size={40} className="text-blue-600" />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Nama Lengkap</h3>
                <p className="text-lg font-medium text-gray-900">{selectedTenant.name}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Email</h3>
                <p className="text-gray-900">{selectedTenant.email}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Nomor Telepon</h3>
                <p className="text-gray-900">{selectedTenant.phone}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Periode Sewa</h3>
                <p className="text-gray-900">
                  {new Date(selectedTenant.start_date).toLocaleDateString('id-ID')} - {' '}
                  {new Date(selectedTenant.end_date).toLocaleDateString('id-ID')}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Status Pembayaran</h3>
                <Badge 
                  className={
                    selectedTenant.payment_status === 'paid' 
                      ? 'bg-green-100 text-green-800'
                      : selectedTenant.payment_status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }
                >
                  {selectedTenant.payment_status === 'paid' ? 'Lunas' :
                   selectedTenant.payment_status === 'pending' ? 'Menunggu' : 'Terlambat'}
                </Badge>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button 
                variant="danger"
                onClick={() => handleRemoveTenant(selectedRoom)}
                disabled={isLoading}
              >
                Hapus Penyewa
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tenant Selector Modal */}
      {showTenantSelector && selectedRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Pilih Penyewa</h2>
              <button 
                onClick={() => {
                  setShowTenantSelector(false);
                  setSelectedRoom(undefined);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            {tenants.filter(tenant => tenant.status === 'active' && !tenant.room_id).length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {tenants
                  .filter(tenant => tenant.status === 'active' && !tenant.room_id)
                  .map(tenant => (
                    <button
                      key={tenant.id}
                      onClick={() => handleTenantSelection(tenant.id)}
                      className="w-full text-left p-3 hover:bg-gray-50 rounded-lg border border-gray-200"
                      disabled={isLoading}
                    >
                      <div className="font-medium">{tenant.name}</div>
                      <div className="text-sm text-gray-500">{tenant.email}</div>
                      <div className="text-sm text-gray-500">{tenant.phone}</div>
                    </button>
                  ))
                }
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                Tidak ada penyewa yang tersedia.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Rooms;