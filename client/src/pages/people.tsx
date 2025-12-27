import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Car, X, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Account, AccountMember, User, Vehicle, VehicleMember, Invitation } from "@shared/schema";
import { Mail, Clock } from "lucide-react";
import { format } from "date-fns";

type MemberWithUser = AccountMember & { user: User };

export default function People() {
  const params = useParams();
  const accountId = params.accountId || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");

  const { data: roleData, isLoading: roleLoading } = useQuery<{ role: string }>({
    queryKey: ["/api/accounts", accountId, "my-role"],
    enabled: !!accountId,
  });

  const isAdminOrOwner = roleData?.role === "owner" || roleData?.role === "admin";

  useEffect(() => {
    if (!roleLoading && roleData && !isAdminOrOwner) {
      setLocation(`/upload/${accountId}`);
    }
  }, [roleLoading, roleData, isAdminOrOwner, accountId, setLocation]);

  const { data: account, isLoading: accountLoading, error: accountError } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
    enabled: !!accountId,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<MemberWithUser[]>({
    queryKey: ["/api/accounts", accountId, "members"],
    enabled: !!accountId && isAdminOrOwner,
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/accounts", accountId, "vehicles"],
    enabled: !!accountId && isAdminOrOwner,
  });

  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<Invitation[]>({
    queryKey: ["/api/accounts", accountId, "invitations"],
    enabled: !!accountId && isAdminOrOwner,
  });

  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [vehicleAssignments, setVehicleAssignments] = useState<Record<string, VehicleMember[]>>({});

  const sendInvitationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/accounts/${accountId}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "invitations"] });
      setEmail("");
      toast({
        title: "Invitation sent",
        description: "An email invitation has been sent to join the account",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest(`/api/accounts/${accountId}/invitations/${invitationId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "invitations"] });
      toast({
        title: "Invitation revoked",
        description: "The invitation has been cancelled",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to revoke invitation",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest(`/api/accounts/${accountId}/members/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "members"] });
      toast({
        title: "Role updated",
        description: "The member's role has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    },
  });

  const deactivateMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/accounts/${accountId}/members/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({
        title: "Member deactivated",
        description: "The member has been deactivated from the account",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to deactivate member",
        variant: "destructive",
      });
    },
  });

  const assignVehicleMutation = useMutation({
    mutationFn: async ({ vehicleId, userId }: { vehicleId: string; userId: string }) => {
      return apiRequest(`/api/accounts/${accountId}/vehicles/${vehicleId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
    },
    onSuccess: (_, { userId }) => {
      loadVehicleAssignments(userId);
      toast({
        title: "Vehicle assigned",
        description: "The vehicle has been assigned to this member",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign vehicle",
        variant: "destructive",
      });
    },
  });

  const unassignVehicleMutation = useMutation({
    mutationFn: async ({ vehicleId, userId }: { vehicleId: string; userId: string }) => {
      return apiRequest(`/api/accounts/${accountId}/vehicles/${vehicleId}/members/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: (_, { userId }) => {
      loadVehicleAssignments(userId);
      toast({
        title: "Vehicle unassigned",
        description: "The vehicle has been unassigned from this member",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to unassign vehicle",
        variant: "destructive",
      });
    },
  });

  const loadVehicleAssignments = async (userId: string) => {
    const assignedVehicles: VehicleMember[] = [];
    for (const vehicle of vehicles.filter(v => v.active)) {
      try {
        const members = await apiRequest<VehicleMember[]>(`/api/accounts/${accountId}/vehicles/${vehicle.id}/members`);
        const userAssignment = members.find(m => m.userId === userId);
        if (userAssignment) {
          assignedVehicles.push(userAssignment);
        }
      } catch (error) {
        console.error("Error loading vehicle members:", error);
      }
    }
    setVehicleAssignments(prev => ({ ...prev, [userId]: assignedVehicles }));
  };

  const toggleMemberExpand = (userId: string) => {
    if (expandedMember === userId) {
      setExpandedMember(null);
    } else {
      setExpandedMember(userId);
      if (!vehicleAssignments[userId]) {
        loadVehicleAssignments(userId);
      }
    }
  };

  const getAssignedVehicleIds = (userId: string): string[] => {
    return (vehicleAssignments[userId] || []).map(a => a.vehicleId);
  };

  if (!accountId) {
    setLocation("/accounts");
    return null;
  }

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdminOrOwner) {
    return null;
  }

  if (accountLoading || membersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading people...</p>
        </div>
      </div>
    );
  }

  if (accountError || !account) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>Account Not Found</CardTitle>
            <CardDescription>
              This account could not be loaded. Please try switching to a different account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" data-testid="button-switch-account-error">
              <Link href="/accounts">
                Switch Account
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <>
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">People</h1>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invite Member</CardTitle>
              <CardDescription>Send an email invitation to join this account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="member@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="input-member-email"
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="w-full sm:w-32" data-testid="select-member-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => sendInvitationMutation.mutate()}
                    disabled={!email || sendInvitationMutation.isPending}
                    data-testid="button-send-invitation"
                    className="shrink-0"
                  >
                    {sendInvitationMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-1" />
                        Invite
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {invitations.filter(inv => inv.status === "pending").length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Pending Invitations
                </CardTitle>
                <CardDescription>These people have been invited but haven't responded yet</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {invitations
                  .filter(inv => inv.status === "pending")
                  .map(invitation => (
                    <div
                      key={invitation.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg"
                      data-testid={`invitation-${invitation.id}`}
                    >
                      <div>
                        <div className="font-medium">{invitation.email}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">{invitation.role}</Badge>
                          {invitation.createdAt && (
                            <span>Sent {format(new Date(invitation.createdAt), "MMM d, yyyy")}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeInvitationMutation.mutate(invitation.id)}
                        disabled={revokeInvitationMutation.isPending}
                        data-testid={`button-revoke-${invitation.id}`}
                        className="text-destructive hover:text-destructive"
                      >
                        Revoke
                      </Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Current Members</h2>
            <div className="space-y-2">
              {members.filter(member => member.active).map(member => (
                <Card key={member.id}>
                  <CardHeader className="py-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">
                          {member.user.firstName} {member.user.lastName}
                        </CardTitle>
                        <CardDescription className="text-sm truncate">
                          {member.user.email}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {member.role === "owner" ? (
                          <span className="text-sm text-muted-foreground capitalize px-3">{member.role}</span>
                        ) : (
                          <Select
                            value={member.role}
                            onValueChange={(newRole) => updateRoleMutation.mutate({ userId: member.userId, role: newRole })}
                            disabled={updateRoleMutation.isPending}
                          >
                            <SelectTrigger className="w-full sm:w-32" data-testid={`select-role-${member.userId}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member" data-testid={`option-member-${member.userId}`}>Member</SelectItem>
                              <SelectItem value="admin" data-testid={`option-admin-${member.userId}`}>Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleMemberExpand(member.userId)}
                            data-testid={`button-vehicles-${member.userId}`}
                            className="flex-1 sm:flex-none"
                          >
                            <Car className="w-4 h-4 mr-1" />
                            Vehicles
                            {expandedMember === member.userId ? (
                              <ChevronUp className="w-4 h-4 ml-1" />
                            ) : (
                              <ChevronDown className="w-4 h-4 ml-1" />
                            )}
                          </Button>
                          {member.role !== "owner" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deactivateMemberMutation.mutate(member.userId)}
                              disabled={deactivateMemberMutation.isPending}
                              data-testid={`button-deactivate-member-${member.userId}`}
                              className="text-destructive hover:text-destructive flex-1 sm:flex-none"
                            >
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  {expandedMember === member.userId && (
                    <CardContent className="pt-0 pb-4">
                      <div className="border-t pt-4">
                        <div className="text-sm font-medium mb-2">Assigned Vehicles</div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {getAssignedVehicleIds(member.userId).length === 0 ? (
                            <span className="text-sm text-muted-foreground">No vehicles assigned</span>
                          ) : (
                            getAssignedVehicleIds(member.userId).map(vehicleId => {
                              const vehicle = vehicles.find(v => v.id === vehicleId);
                              if (!vehicle) return null;
                              return (
                                <Badge key={vehicleId} variant="secondary" className="flex items-center gap-1" data-testid={`badge-vehicle-${vehicleId}`}>
                                  {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                                  <button
                                    onClick={() => unassignVehicleMutation.mutate({ vehicleId, userId: member.userId })}
                                    className="ml-1 hover:text-destructive"
                                    data-testid={`button-unassign-vehicle-${vehicleId}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </Badge>
                              );
                            })
                          )}
                        </div>
                        <div className="text-sm font-medium mb-2">Add Vehicle</div>
                        <Select
                          value=""
                          onValueChange={(vehicleId) => {
                            if (vehicleId) {
                              assignVehicleMutation.mutate({ vehicleId, userId: member.userId });
                            }
                          }}
                          disabled={assignVehicleMutation.isPending}
                        >
                          <SelectTrigger className="w-full" data-testid={`select-assign-vehicle-${member.userId}`}>
                            <SelectValue placeholder="Select a vehicle to assign" />
                          </SelectTrigger>
                          <SelectContent>
                            {vehicles
                              .filter(v => v.active && !getAssignedVehicleIds(member.userId).includes(v.id))
                              .map(vehicle => (
                                <SelectItem key={vehicle.id} value={vehicle.id} data-testid={`option-vehicle-${vehicle.id}`}>
                                  {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
