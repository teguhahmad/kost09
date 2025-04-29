import React, { useState, useEffect } from 'react';
import Card, { CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Plus, Search, Edit, Trash, Loader2, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/formatters';
import { SubscriptionPlan } from '../../types/subscription';

const SubscriptionPlans: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<SubscriptionPlan | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price');

      if (fetchError) throw fetchError;
      setPlans(data || []);
    } catch (err) {
      console.error('Error loading plans:', err);
      setError('Failed to load subscription plans');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (formData: Partial<SubscriptionPlan>) => {
    try {
      setIsLoading(true);
      setError(null);

      if (editingPlan) {
        const { error: updateError } = await supabase
          .from('subscription_plans')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingPlan.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('subscription_plans')
          .insert([formData]);

        if (insertError) throw insertError;
      }

      await loadPlans();
      setShowForm(false);
      setEditingPlan(null);
    } catch (err) {
      console.error('Error saving plan:', err);
      setError('Failed to save subscription plan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (plan: SubscriptionPlan) => {
    setPlanToDelete(plan);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!planToDelete) return;

    try {
      setIsLoading(true);
      setError(null);

      // Check if any users are subscribed to this plan
      const { data: subscriptions, error: checkError } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('plan_id', planToDelete.id)
        .eq('status', 'active');

      if (checkError) throw checkError;

      if (subscriptions && subscriptions.length > 0) {
        throw new Error('Cannot delete plan with active subscriptions');
      }

      const { error: deleteError } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', planToDelete.id);

      if (deleteError) throw deleteError;

      await loadPlans();
      setShowDeleteConfirm(false);
      setPlanToDelete(null);
    } catch (err) {
      console.error('Error deleting plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete plan');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPlans = plans.filter(plan =>
    plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-800">All Plans</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search plans..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
            </div>
            <Button 
              icon={<Plus size={16} />}
              onClick={() => {
                setEditingPlan(null);
                setShowForm(true);
              }}
              disabled={isLoading}
            >
              Add Plan
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
              <p className="mt-2 text-gray-500">Loading subscription plans...</p>
            </div>
          ) : filteredPlans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                        <p className="text-sm text-gray-500">{plan.description}</p>
                      </div>
                      <Badge className={
                        plan.price === 0 ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }>
                        {plan.price === 0 ? 'Free' : formatCurrency(plan.price)}
                      </Badge>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Max Properties</span>
                        <span className="font-medium">{plan.max_properties}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Rooms per Property</span>
                        <span className="font-medium">{plan.max_rooms_per_property}</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <h4 className="text-sm font-medium text-gray-700">Features</h4>
                      <div className="space-y-1">
                        {Object.entries(plan.features).map(([key, value]) => (
                          <div key={key} className="flex items-center text-sm">
                            {value ? (
                              <CheckCircle size={16} className="text-green-500 mr-2" />
                            ) : (
                              <AlertTriangle size={16} className="text-red-500 mr-2" />
                            )}
                            <span className="text-gray-600">
                              {key.split('_').map(word => 
                                word.charAt(0).toUpperCase() + word.slice(1)
                              ).join(' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Edit size={14} />}
                        onClick={() => {
                          setEditingPlan(plan);
                          setShowForm(true);
                        }}
                        disabled={isLoading}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<Trash size={14} />}
                        onClick={() => handleDeleteClick(plan)}
                        disabled={isLoading}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No subscription plans found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && planToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Delete Subscription Plan
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete the "{planToDelete.name}" plan? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setPlanToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                icon={<Trash size={16} />}
              >
                Delete Plan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Plan Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingPlan ? 'Edit Subscription Plan' : 'Add New Plan'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingPlan(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formElement = e.target as HTMLFormElement;
                const formData = new FormData(formElement);
                
                const features = {
                  tenant_data: formData.get('feature_tenant_data') === 'on',
                  auto_billing: formData.get('feature_auto_billing') === 'on',
                  billing_notifications: formData.get('feature_billing_notifications') === 'on',
                  financial_reports: formData.get('feature_financial_reports'),
                  data_backup: formData.get('feature_data_backup'),
                  multi_user: formData.get('feature_multi_user') === 'on',
                  analytics: formData.get('feature_analytics') === 'on',
                  support: formData.get('feature_support')
                };

                handleSubmit({
                  name: formData.get('name') as string,
                  description: formData.get('description') as string,
                  price: parseInt(formData.get('price') as string),
                  max_properties: parseInt(formData.get('max_properties') as string),
                  max_rooms_per_property: parseInt(formData.get('max_rooms_per_property') as string),
                  features
                });
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plan Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingPlan?.name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (IDR)
                  </label>
                  <input
                    type="number"
                    name="price"
                    defaultValue={editingPlan?.price}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Properties
                  </label>
                  <input
                    type="number"
                    name="max_properties"
                    defaultValue={editingPlan?.max_properties}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Rooms per Property
                  </label>
                  <input
                    type="number"
                    name="max_rooms_per_property"
                    defaultValue={editingPlan?.max_rooms_per_property}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={editingPlan?.description}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Features</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="feature_tenant_data"
                        defaultChecked={editingPlan?.features.tenant_data}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Tenant Data</span>
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="feature_auto_billing"
                        defaultChecked={editingPlan?.features.auto_billing}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Auto Billing</span>
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="feature_billing_notifications"
                        defaultChecked={editingPlan?.features.billing_notifications}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Billing Notifications</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Financial Reports</label>
                    <select
                      name="feature_financial_reports"
                      defaultValue={editingPlan?.features.financial_reports}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="basic">Basic</option>
                      <option value="advanced">Advanced</option>
                      <option value="predictive">Predictive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Data Backup</label>
                    <select
                      name="feature_data_backup"
                      defaultValue={editingPlan?.features.data_backup}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="false">No Backup</option>
                      <option value="weekly">Weekly</option>
                      <option value="daily">Daily</option>
                      <option value="realtime">Realtime</option>
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="feature_multi_user"
                        defaultChecked={editingPlan?.features.multi_user}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Multi User</span>
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="feature_analytics"
                        defaultChecked={editingPlan?.features.analytics}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Analytics</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Support Level</label>
                    <select
                      name="feature_support"
                      defaultValue={editingPlan?.features.support}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="basic">Basic</option>
                      <option value="priority">Priority</option>
                      <option value="24/7">24/7</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingPlan(null);
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  icon={isLoading ? <Loader2 className="animate-spin" size={16} /> : undefined}
                >
                  {isLoading ? 'Saving...' : editingPlan ? 'Save Changes' : 'Add Plan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPlans;