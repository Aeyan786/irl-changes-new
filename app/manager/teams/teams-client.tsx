"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  createTeam,
  updateTeam,
  deleteTeam,
  removeTeamMember,
  acceptTeamInvitation,
  rejectTeamInvitation,
  acceptJoinRequest,
  rejectJoinRequest,
} from "@/app/actions/teams";
import {
  assignAssistantManager,
  removeAssistantManager,
} from "@/app/actions/assistant-manager";
import {
  sendTeamInviteByEmail,
  generateTeamInviteLink,
  cancelInvitation,
  resendInvitation,
} from "@/app/actions/invitations";

import { useRouter } from "next/navigation";
import { TeamLogoUpload } from "@/components/team-logo-upload";
import { TeamLogo } from "@/components/team-logo";
import {
  Search,
  CheckCircle2,
  Users,
  UserPlus,
  Mail,
  Link2,
  Copy,
  Check,
  X,
  Clock,
  Loader2,
  Send,
  RefreshCw,
  Trash2,
  User,
  Eye,
  Filter,
  Plus,
  UserMinus,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pencil,
  Save,
  AlertTriangle,
  Crown,
  GraduationCap,
} from "lucide-react";

interface Address {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

interface TeamMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  gender: string | null;
  age: number | null;
  address?: Address | null;
  past_achievements?: string | null;
  disabilities?: string | null;
  current_team_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  role?: string | null;
}

interface Team {
  id: string;
  name: string;
  manager_id: string;
  members: string[];
  details?: string | null;
  is_high_school?: boolean;
  logo_url?: string | null;
  created_at: string;
  updated_at?: string | null;
  memberDetails?: TeamMember[];
}

interface Invitation {
  id: string;
  from_user_id: string;
  to_user_id: string | null;
  to_email: string | null;
  team_id: string;
  status: string;
  type: string;
  invite_link: string | null;
  created_at: string;
  team: {
    id: string;
    name: string;
  } | null;
  to_user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  from_user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

interface AssistantManager {
  id: string;
  user_id: string;
  assigned_by: string;
  created_at: string;
  user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    gender: string | null;
  } | null;
}

interface TeamsClientProps {
  teams: Team[];
  allRunners: TeamMember[];
  sentInvitations: Invitation[];
  joinRequests: Invitation[];
  assistantManagers?: AssistantManager[];
  managerId: string;
  isAssistantManager?: boolean;
}

const ITEMS_PER_PAGE = 10;

export function TeamsClient({
  teams,
  allRunners,
  sentInvitations,
  joinRequests,
  managerId,
  assistantManagers = [],
  isAssistantManager = false,
}: TeamsClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const myTeam = teams[0] || null;

  // Silently refresh when team or invitation data changes
  useEffect(() => {
    const { createClient } = require("@/lib/supabase/client");
    const supabase = createClient();
    const channel = supabase
      .channel("manager-teams-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        () => {
          router.refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invitations" },
        () => {
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Search, filter, and pagination state (for available runners panel)
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Member search (for My Team roster)
  const [memberSearch, setMemberSearch] = useState("");
  const [memberGenderFilter, setMemberGenderFilter] = useState<string>("all");
  const [memberRoleFilter, setMemberRoleFilter] = useState<string>("all");

  // Assistant Manager state
  const [localAMs, setLocalAMs] =
    useState<AssistantManager[]>(assistantManagers);
  const [amDialogOpen, setAmDialogOpen] = useState(false);
  const [amMemberId, setAmMemberId] = useState<string>("");
  const [isAssigningAM, setIsAssigningAM] = useState(false);
  const [removeAMDialogOpen, setRemoveAMDialogOpen] = useState(false);
  const [amToRemove, setAmToRemove] = useState<AssistantManager | null>(null);
  const [isRemovingAM, setIsRemovingAM] = useState(false);

  // Create team dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [teamIsHighSchool, setTeamIsHighSchool] = useState(false);
  const [createLogoUrl, setCreateLogoUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Invite dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteMethod, setInviteMethod] = useState<"email" | "link">("email");
  const [inviteEmail, setInviteEmail] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string>("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // Remove member dialog state
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // View member dialog state
  const [viewMemberDialogOpen, setViewMemberDialogOpen] = useState(false);
  const [viewMember, setViewMember] = useState<TeamMember | null>(null);

  // Edit team state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [editIsHighSchool, setEditIsHighSchool] = useState(false);
  const [editLogoUrl, setEditLogoUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete team state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Processing states
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  // Get all members across teams to exclude from available runners
  const allTeamMemberIds = useMemo(() => {
    const memberIds = new Set<string>();
    teams.forEach((team) => {
      team.members?.forEach((id) => memberIds.add(id));
    });
    return memberIds;
  }, [teams]);

  // Get pending invitation user IDs/emails
  const pendingInviteRecipients = useMemo(() => {
    const recipients = new Set<string>();
    sentInvitations
      .filter((i) => i.status === "pending")
      .forEach((invite) => {
        if (invite.to_user_id) recipients.add(invite.to_user_id);
        if (invite.to_email) recipients.add(invite.to_email.toLowerCase());
      });
    return recipients;
  }, [sentInvitations]);

  // Filter runners: exclude those already in a team or with pending invites
  const availableRunners = useMemo(() => {
    return allRunners.filter((runner) => {
      // Exclude if already in any team (via current_team_id)
      if (runner.current_team_id) return false;
      // Exclude if already in any team (via members array)
      if (allTeamMemberIds.has(runner.id)) return false;
      // Exclude if has pending invitation
      if (pendingInviteRecipients.has(runner.id)) return false;
      if (pendingInviteRecipients.has(runner.email.toLowerCase())) return false;
      return true;
    });
  }, [allRunners, allTeamMemberIds, pendingInviteRecipients]);

  // Apply search and gender filter
  const filteredRunners = useMemo(() => {
    return availableRunners.filter((runner) => {
      const matchesSearch =
        searchQuery === "" ||
        `${runner.first_name} ${runner.last_name}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        runner.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesGender =
        genderFilter === "all" || runner.gender === genderFilter;

      return matchesSearch && matchesGender;
    });
  }, [availableRunners, searchQuery, genderFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRunners.length / ITEMS_PER_PAGE);
  const paginatedRunners = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRunners.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRunners, currentPage]);

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // Filter My Team members by search + gender + role
  const filteredMembers = useMemo(() => {
    if (!myTeam?.memberDetails) return [];
    return myTeam.memberDetails.filter((m) => {
      if (m.id === myTeam.manager_id) return false;
      if (m.id === myTeam.manager_id) return false; // manager shown separately
      const matchesSearch =
        !memberSearch.trim() ||
        `${m.first_name ?? ""} ${m.last_name ?? ""}`
          .toLowerCase()
          .includes(memberSearch.toLowerCase()) ||
        m.email.toLowerCase().includes(memberSearch.toLowerCase());

      const matchesGender =
        memberGenderFilter === "all" || (m.gender ?? "") === memberGenderFilter;

      const matchesRole =
        memberRoleFilter === "all" ||
        (memberRoleFilter === "assistant_manager"
          ? m.role === "assistant_manager"
          : memberRoleFilter === "runner"
            ? m.role !== "assistant_manager"
            : true);

      return matchesSearch && matchesGender && matchesRole;
    });
  }, [
    myTeam?.memberDetails,
    memberSearch,
    memberGenderFilter,
    memberRoleFilter,
  ]);

  const handleGenderFilterChange = (value: string) => {
    setGenderFilter(value);
    setCurrentPage(1);
  };

  // Categorize invitations
  const pendingInvitations = sentInvitations.filter(
    (i) => i.status === "pending",
  );
  const acceptedInvitations = sentInvitations.filter(
    (i) => i.status === "accepted",
  );
  const rejectedInvitations = sentInvitations.filter(
    (i) => i.status === "rejected",
  );

  // Create team handler
  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast({
        title: "Team name required",
        description: "Please enter a name for your team.",
        variant: "default",
        className: "text-red-600",
      });
      return;
    }

    setIsCreating(true);
    try {
      const result = await createTeam({
        name: teamName.trim(),
        description: teamDescription.trim() || undefined,
        is_high_school: teamIsHighSchool,
        logo_url: createLogoUrl || null,
      });

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
            variant: "default",
        className: "text-red-600",
        });
      } else {
        toast({
          title: "Team created!",
          description: `Your team "${teamName}" has been created successfully.`,
        });
        setCreateDialogOpen(false);
        setTeamName("");
        setTeamDescription("");
        setTeamIsHighSchool(false);
        setCreateLogoUrl(null);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to create team",
        variant: "default",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Edit team handlers
  const startEditing = () => {
    if (myTeam) {
      setEditName(myTeam.name);
      setEditDetails(myTeam.details || "");
      setEditIsHighSchool(myTeam.is_high_school || false);
      setEditLogoUrl(myTeam.logo_url || null);
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditName("");
    setEditDetails("");
    setEditIsHighSchool(false);
  };

  const handleSaveTeam = async () => {
    if (!myTeam || !editName.trim()) {
      toast({
        title: "Team name required",
        description: "Please enter a name for your team.",
          variant: "default",
        className: "text-red-600",
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateTeam(myTeam.id, {
        name: editName.trim(),
        details: editDetails.trim(),
        is_high_school: editIsHighSchool,
        logo_url: editLogoUrl,
      });

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
           variant: "default",
        className: "text-red-600",
        });
      } else {
        toast({
          title: "Team updated",
          description: "Your team details have been saved.",
        });
        setIsEditing(false);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update team",
  variant: "default",
        className: "text-red-600",      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete team handler
  const handleDeleteTeam = async () => {
    if (!myTeam) return;

    setIsDeleting(true);
    try {
      const result = await deleteTeam(myTeam.id);

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
  variant: "default",
        className: "text-red-600",        });
      } else {
        toast({
          title: "Team deleted",
          description: `Team "${result.teamName}" has been deleted.`,
        });
        setDeleteDialogOpen(false);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete team",
  variant: "default",
        className: "text-red-600",      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Invite handlers
  const handleInviteByEmail = async () => {
    if (!inviteEmail || !myTeam) {
      toast({
        title: "Missing information",
        description: "Please enter an email address.",
  variant: "default",
        className: "text-red-600",      });
      return;
    }

    setIsInviting(true);
    try {
      const result = await sendTeamInviteByEmail(myTeam.id, inviteEmail);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
            variant: "default",
        className: "text-red-600",
        });
      } else {
        toast({
          title: "Invitation sent!",
          description: `Invitation sent to ${inviteEmail} for team "${result.teamName}".`,
        });
        setInviteDialogOpen(false);
        setInviteEmail("");
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to send invitation",
  variant: "default",
        className: "text-red-600",      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!myTeam) {
      toast({
        title: "No team",
        description: "Please create a team first.",
  variant: "default",
        className: "text-red-600",      });
      return;
    }

    setIsInviting(true);
    try {
      const result = await generateTeamInviteLink(myTeam.id);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
  variant: "default",
        className: "text-red-600",        });
      } else {
        setGeneratedLink(result.inviteLink || "");
        toast({
          title: "Link generated",
          description: `Invite link created for team "${result.teamName}".`,
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to generate link",
  variant: "default",
        className: "text-red-600",      });
    } finally {
      setIsInviting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setLinkCopied(true);
      toast({
        title: "Copied",
        description: "Invite link copied to clipboard.",
      });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
  variant: "default",
        className: "text-red-600",      });
    }
  };

  // Remove member handler
  const handleRemoveMember = async () => {
    if (!memberToRemove || !myTeam) return;

    setIsRemoving(true);
    try {
      const result = await removeTeamMember(myTeam.id, memberToRemove.id);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
  variant: "default",
        className: "text-red-600",        });
      } else {
        toast({
          title: "Member removed",
          description: `${result.memberName || "Runner"} has been removed from the team.`,
        });
        setRemoveMemberDialogOpen(false);
        setMemberToRemove(null);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to remove member",
  variant: "default",
        className: "text-red-600",      });
    } finally {
      setIsRemoving(false);
    }
  };

  // Assistant Manager handlers
  const handleAssignAM = async () => {
    if (!myTeam || !amMemberId) return;
    setIsAssigningAM(true);
    const result = await assignAssistantManager(myTeam.id, amMemberId);
    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
          variant: "default",
        className: "text-red-600",
      });
    } else {
      toast({
        title: "Invitation Sent",
        description: `${result.name} has been sent an assistant manager invitation.`,
      });
      setAmDialogOpen(false);
      setAmMemberId("");
    }
    setIsAssigningAM(false);
  };

  const [isResigningAM, setIsResigningAM] = useState(false);

  const handleResignAM = async () => {
    if (!myTeam) return;
    setIsResigningAM(true);
    const { resignAssistantManagerRole } =
      await import("@/app/actions/assistant-manager");
    const result = await resignAssistantManagerRole(myTeam.id);
    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
          variant: "default",
        className: "text-red-600",
      });
    } else {
      toast({
        title: "Role resigned",
        description: "You have stepped down from the assistant manager role.",
      });
      window.location.href = "/runner/dashboard";
    }
    setIsResigningAM(false);
  };

  const handleRemoveAM = async () => {
    if (!myTeam || !amToRemove) return;
    setIsRemovingAM(true);
    const result = await removeAssistantManager(myTeam.id, amToRemove.user_id);
    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
          variant: "default",
        className: "text-red-600",
      });
    } else {
      toast({
        title: "Removed",
        description: `${result.name} is no longer an assistant manager.`,
      });
      setLocalAMs((prev) =>
        prev.filter((am) => am.user_id !== amToRemove.user_id),
      );
      setRemoveAMDialogOpen(false);
      setAmToRemove(null);
    }
    setIsRemovingAM(false);
  };

  // Join request handlers
  const handleAcceptJoinRequest = async (invitationId: string) => {
    setProcessingInvite(invitationId);
    try {
      const result = await acceptJoinRequest(invitationId);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "default",
          className: "text-red-600",
        });
      } else {
        toast({
          title: "Request accepted",
          description: `Runner has been added to ${result.teamName}.`,
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to accept request",
          variant: "default",
        className: "text-red-600",
      });
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleRejectJoinRequest = async (invitationId: string) => {
    setProcessingInvite(invitationId);
    try {
      const result = await rejectJoinRequest(invitationId);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
            variant: "default",
        className: "text-red-600",
        });
      } else {
        toast({
          title: "Request declined",
          description: "The join request has been declined.",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to decline request",
          variant: "default",
        className: "text-red-600",
      });
    } finally {
      setProcessingInvite(null);
    }
  };

  // Invitation action handlers
  const handleCancelInvitation = async (invitationId: string) => {
    setProcessingAction(invitationId);
    try {
      const result = await cancelInvitation(invitationId);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
            variant: "default",
        className: "text-red-600",
        });
      } else {
        toast({
          title: "Invitation cancelled",
          description: "The invitation has been cancelled.",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
          variant: "default",
        className: "text-red-600",
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    setProcessingAction(invitationId);
    try {
      const result = await resendInvitation(invitationId);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
            variant: "default",
        className: "text-red-600",
        });
      } else {
        toast({
          title: "Reminder sent",
          description: `Invitation reminder sent for team "${result.teamName}".`,
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to resend invitation",
          variant: "default",
        className: "text-red-600",
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const openInviteDialog = (runnerEmail?: string, runner?: TeamMember) => {
    // Check if runner is already in a team (extra safeguard)
    if (runner?.current_team_id) {
      toast({
        title: "Runner unavailable",
        description: "This runner is already a member of another team.",
          variant: "default",
        className: "text-red-600",
      });
      return;
    }

    if (runnerEmail) {
      setInviteEmail(runnerEmail);
      setInviteMethod("email");
    } else {
      setInviteEmail("");
    }
    setGeneratedLink("");
    setLinkCopied(false);
    setInviteDialogOpen(true);
  };

  const getInitials = (firstName: string | null, lastName: string | null) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?";
  };

  const getGenderBadgeColor = (gender: string | null) => {
    switch (gender) {
      case "male":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "female":
        return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getAddressSummary = (address: Address | null | undefined) => {
    if (!address) return "-";
    const parts = [address.city, address.state].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "-";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
          >
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "accepted":
        return (
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
          >
            <Check className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="secondary"
            className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          >
            <X className="h-3 w-3 mr-1" />
            Declined
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            Team Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your team and invite runners
          </p>
        </div>
        {myTeam && (
          <Button
            className="bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer "
            onClick={() => openInviteDialog()}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Runner
          </Button>
        )}
      </div>

      {/* Join Requests Alert */}
      {joinRequests.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Join Requests
              <Badge variant="secondary">{joinRequests.length}</Badge>
            </CardTitle>
            <CardDescription>
              Runners requesting to join your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {joinRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col gap-3 p-3 rounded-lg bg-card border sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(
                          request.from_user?.first_name || null,
                          request.from_user?.last_name || null,
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {request.from_user?.first_name || ""}{" "}
                        {request.from_user?.last_name || "Unknown"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {request.from_user?.email} - Wants to join{" "}
                        <span className="font-medium">
                          {request.team?.name}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-13 sm:ml-0">
                    <Button
                      size="sm"
                      className="cursor-pointer"
                      onClick={() => handleAcceptJoinRequest(request.id)}
                      disabled={processingInvite === request.id}
                    >
                      {processingInvite === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Accept
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-transparent cursor-pointer"
                      onClick={() => handleRejectJoinRequest(request.id)}
                      disabled={processingInvite === request.id}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Team Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold text-foreground">My Team-mates</h2>
        </div>

        {!myTeam ? (
          <Card className="bg-muted/30">
            <CardContent className="py-12 text-center">
              <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Team Yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Create your team to start inviting runners and registering for
                races.
              </p>
              <Button
                className="bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer "
                size="lg"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Team
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 hover:border-accent/30 transition-colors bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">Team Name</Label>
                        <Input
                          id="edit-name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Enter team name"
                          className="max-w-md"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-details">
                          Description (optional)
                        </Label>
                        <Textarea
                          id="edit-details"
                          value={editDetails}
                          onChange={(e) => setEditDetails(e.target.value)}
                          placeholder="Add a description for your team..."
                          className="max-w-md resize-none"
                          rows={3}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="edit-high-school"
                          checked={editIsHighSchool}
                          onCheckedChange={(checked) =>
                            setEditIsHighSchool(!!checked)
                          }
                          className="border-black data-[state=checked]:bg-black data-[state=checked]:border-black"
                        />
                        <Label
                          htmlFor="edit-high-school"
                          className="cursor-pointer flex items-center gap-1.5"
                        >
                          High School Team
                        </Label>
                      </div>
                      <div className="space-y-2">
                        <Label>Team Logo</Label>
                        <TeamLogoUpload
                          teamId={myTeam.id}
                          currentLogoUrl={editLogoUrl}
                          onUploadComplete={setEditLogoUrl}
                          size="md"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleSaveTeam}
                          disabled={isSaving}
                          className="bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer text-white"
                        >
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Save Changes
                        </Button>
                        <Button
                          variant="outline"
                          onClick={cancelEditing}
                          disabled={isSaving}
                          className="bg-transparent cursor-pointer"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <TeamLogo
                          logoUrl={myTeam.logo_url}
                          teamName={myTeam.name}
                          size={40}
                        />
                        {myTeam.is_high_school && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <GraduationCap className="h-5 w-5 text-accent flex-shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>High School Team</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {myTeam.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
                        <span>
                          {myTeam.memberDetails?.length || 0} member
                          {(myTeam.memberDetails?.length || 0) !== 1 ? "s" : ""}
                        </span>
                      </CardDescription>
                      {myTeam.details && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {myTeam.details}
                        </p>
                      )}
                    </>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startEditing}
                      className="cursor-pointer bg-transparent"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    {!isAssistantManager && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteDialogOpen(true)}
                        className="cursor-pointer border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive bg-transparent"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {myTeam.memberDetails && myTeam.memberDetails.length > 0 ? (
                <>
                  {/* Manager row */}
                  {(() => {
                    const manager = myTeam.memberDetails?.find(
                      (m) => m.id === myTeam.manager_id,
                    );
                    if (!manager) return null;
                    return (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Manager
                        </p>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-amber-500 text-white text-xs font-semibold">
                              {getInitials(
                                manager.first_name,
                                manager.last_name,
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">
                              {manager.first_name} {manager.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {manager.email}
                            </p>
                          </div>
                          <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Member search + filters */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or email..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Select
                        value={memberGenderFilter}
                        onValueChange={setMemberGenderFilter}
                      >
                        <SelectTrigger className="w-28 sm:w-32">
                          <SelectValue placeholder="Gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Genders</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={memberRoleFilter}
                        onValueChange={setMemberRoleFilter}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value="runner">Runners</SelectItem>
                          <SelectItem value="assistant_manager">
                            Asst. Manager
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {(memberSearch ||
                        memberGenderFilter !== "all" ||
                        memberRoleFilter !== "all") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 px-2 text-muted-foreground cursor-pointer hover:text-foreground"
                          onClick={() => {
                            setMemberSearch("");
                            setMemberGenderFilter("all");
                            setMemberRoleFilter("all");
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Runner</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Gender</TableHead>
                          <TableHead>Age</TableHead>
                          <TableHead className="hidden lg:table-cell">
                            Location
                          </TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMembers.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="py-6 text-center text-muted-foreground text-sm"
                            >
                              {memberSearch ||
                              memberGenderFilter !== "all" ||
                              memberRoleFilter !== "all"
                                ? "No members match the current filters"
                                : "No members in this team yet"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredMembers.map((member) => (
                            <TableRow key={member.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs font-semibold bg-secondary text-secondary-foreground">
                                      {getInitials(
                                        member.first_name,
                                        member.last_name,
                                      )}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {member.first_name || ""}{" "}
                                      {member.last_name || "Runner"}
                                    </span>
                                    {member.role === "assistant_manager" && (
                                      <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">
                                        AM
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {member.email}
                              </TableCell>
                              <TableCell>
                                {member.gender && (
                                  <Badge
                                    variant="outline"
                                    className={getGenderBadgeColor(
                                      member.gender,
                                    )}
                                  >
                                    {member.gender}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>{member.age || "-"}</TableCell>
                              <TableCell className="hidden lg:table-cell text-muted-foreground">
                                {member.address ? (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {[member.address.city, member.address.state]
                                      .filter(Boolean)
                                      .join(", ") || "-"}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="cursor-pointer flex items-center justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="cursor-pointer"
                                    onClick={() => {
                                      setViewMember(member);
                                      setViewMemberDialogOpen(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                    <span className="sr-only">
                                      View Details
                                    </span>
                                  </Button>
                                  {member.id === managerId &&
                                  isAssistantManager ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-orange-600 cursor-pointer hover:text-orange-700 hover:bg-orange-50 bg-transparent"
                                      onClick={handleResignAM}
                                      disabled={isResigningAM}
                                    >
                                      {isResigningAM ? (
                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                      ) : (
                                        <UserMinus className="h-4 w-4 mr-1" />
                                      )}
                                      Leave AM Role
                                    </Button>
                                  ) : member.id !== managerId ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10 bg-transparent"
                                      onClick={() => {
                                        setMemberToRemove(member);
                                        setRemoveMemberDialogOpen(true);
                                      }}
                                    >
                                      <UserMinus className="h-4 w-4 mr-1" />
                                      Remove
                                    </Button>
                                  ) : null}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-3">
                    {filteredMembers.length === 0 ? (
                      <p className="py-6 text-center text-muted-foreground text-sm">
                        {memberSearch ||
                        memberGenderFilter !== "all" ||
                        memberRoleFilter !== "all"
                          ? "No members match the current filters"
                          : "No members in this team yet"}
                      </p>
                    ) : (
                      filteredMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-secondary text-secondary-foreground">
                              {getInitials(member.first_name, member.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {member.first_name || ""}{" "}
                              {member.last_name || "Runner"}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {member.email}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {member.gender && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${getGenderBadgeColor(member.gender)}`}
                                >
                                  {member.gender}
                                </Badge>
                              )}
                              {member.age && (
                                <span className="text-xs text-muted-foreground">
                                  {member.age}y
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="outline"
                            className="text-destructive cursor-pointer hover:text-destructive hover:bg-destructive/10 bg-transparent shrink-0"
                            onClick={() => {
                              setMemberToRemove(member);
                              setRemoveMemberDialogOpen(true);
                            }}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground mb-4">
                    No runners in your team yet. Start inviting runners below!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Assistant Managers Section ── */}
      {myTeam && !isAssistantManager && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Assistant Managers</h2>
              <p className="text-sm text-muted-foreground">
                Assign team members to help manage runners and view payments.
                They cannot remove you.
              </p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm"
                      onClick={() => setAmDialogOpen(true)}
                      className="bg-[#EE0505] cursor-pointer
                       hover:bg-red-700"
                      disabled={
                        !myTeam.memberDetails ||
                        myTeam.memberDetails.length === 0 ||
                        localAMs.length > 0
                      }
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Assign AM
                    </Button>
                  </span>
                </TooltipTrigger>
                {localAMs.length > 0 && (
                  <TooltipContent>
                    Remove the current AM before assigning a new one.
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>

          {localAMs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              No assistant managers assigned yet.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Email
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Assigned
                    </TableHead>
                    <TableHead className="text-right">Remove</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localAMs.map((am) => (
                    <TableRow key={am.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-orange-500/10 text-orange-600 text-xs">
                              {`${am.user?.first_name?.charAt(0) || ""}${am.user?.last_name?.charAt(0) || ""}`.toUpperCase() ||
                                "AM"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {am.user?.first_name} {am.user?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground sm:hidden">
                              {am.user?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {am.user?.email}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {new Date(am.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive cursor-pointer hover:text-destructive"
                          onClick={() => {
                            setAmToRemove(am);
                            setRemoveAMDialogOpen(true);
                          }}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Available Runners Section */}
      {myTeam && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-foreground">
              Available Runners
            </h2>
            <Badge
              variant="secondary"
              className="bg-accent/10 text-accent border-accent/30"
            >
              {availableRunners.length} available
            </Badge>
          </div>

          <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={genderFilter}
                    onValueChange={handleGenderFilterChange}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Runner</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRunners.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No available runners found. Only runners not already
                          in a team are shown here.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedRunners.map((runner) => (
                        <TableRow key={runner.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {getInitials(
                                    runner.first_name,
                                    runner.last_name,
                                  )}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {runner.first_name || ""}{" "}
                                  {runner.last_name || "Unknown"}
                                </span>
                                {runner.role === "assistant_manager" && (
                                  <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">
                                    AM
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {runner.email}
                          </TableCell>
                          <TableCell>{runner.age || "-"}</TableCell>
                          <TableCell>
                            {runner.gender && (
                              <Badge
                                variant="outline"
                                className={getGenderBadgeColor(runner.gender)}
                              >
                                {runner.gender}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="text-sm">
                                {getAddressSummary(runner.address)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {runner.current_team_id ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      className="bg-accent/50 cursor-not-allowed text-white/70"
                                      disabled
                                    >
                                      <UserPlus className="h-4 w-4 mr-1" />
                                      Invite
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Runner is already in a team.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Button
                                size="sm"
                                variant={"outline"}
                                className=" bg-white cursor-pointer "
                                onClick={() =>
                                  openInviteDialog(runner.email, runner)
                                }
                              >
                                <UserPlus className="h-4 w-4 mr-1" />
                                Invite
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {paginatedRunners.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No available runners found. Only runners not already in a
                    team are shown here.
                  </div>
                ) : (
                  paginatedRunners.map((runner) => (
                    <Card key={runner.id} className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {getInitials(
                                  runner.first_name,
                                  runner.last_name,
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {runner.first_name || ""}{" "}
                                {runner.last_name || "Unknown"}
                              </p>
                              <p className="text-sm text-muted-foreground truncate max-w-[180px]">
                                {runner.email}
                              </p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {runner.gender && (
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${getGenderBadgeColor(runner.gender)}`}
                                  >
                                    {runner.gender}
                                  </Badge>
                                )}
                                {runner.age && (
                                  <span className="text-xs text-muted-foreground">
                                    {runner.age}y
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {getAddressSummary(runner.address)}
                                </span>
                              </div>
                            </div>
                          </div>
                          {runner.current_team_id ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    className="bg-accent/50 cursor-not-allowed text-white/70"
                                    disabled
                                  >
                                    <UserPlus className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Runner is already in a team.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-accent hover:bg-accent/90 cursor-pointer text-white"
                              onClick={() =>
                                openInviteDialog(runner.email, runner)
                              }
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
                    {Math.min(
                      currentPage * ITEMS_PER_PAGE,
                      filteredRunners.length,
                    )}{" "}
                    of {filteredRunners.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-transparent"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-transparent"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Invitations Tabs - Only show if team exists */}
      {myTeam && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Send className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-foreground">
              Sent Invitations
            </h2>
          </div>

          <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
            <Tabs defaultValue="pending" className="w-full">
              <CardHeader className="pb-0">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="pending" className="relative">
                    Pending
                    {pendingInvitations.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-2 h-5 px-1.5 text-xs"
                      >
                        {pendingInvitations.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="accepted">
                    Accepted
                    {acceptedInvitations.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-2 h-5 px-1.5 text-xs"
                      >
                        {acceptedInvitations.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="rejected">
                    Declined
                    {rejectedInvitations.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-2 h-5 px-1.5 text-xs"
                      >
                        {rejectedInvitations.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className="pt-6">
                <TabsContent value="pending" className="mt-0">
                  {pendingInvitations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No pending invitations</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingInvitations.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex flex-col gap-3 p-3 rounded-lg border sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-medium">
                              {invite.to_user
                                ? `${invite.to_user.first_name || ""} ${invite.to_user.last_name || ""}`.trim() ||
                                  invite.to_email
                                : invite.to_email || "Invite Link"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Sent{" "}
                              {new Date(invite.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-transparent cursor-pointer"
                              onClick={() => handleResendInvitation(invite.id)}
                              disabled={processingAction === invite.id}
                            >
                              {processingAction === invite.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-1" />
                                  Resend
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 bg-transparent cursor-pointer"
                              onClick={() => handleCancelInvitation(invite.id)}
                              disabled={processingAction === invite.id}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="accepted" className="mt-0">
                  {acceptedInvitations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Check className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No accepted invitations yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {acceptedInvitations.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-green-50 dark:bg-green-950/20"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-green-200 text-green-800">
                              {getInitials(
                                invite.to_user?.first_name || null,
                                invite.to_user?.last_name || null,
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">
                              {invite.to_user
                                ? `${invite.to_user.first_name || ""} ${invite.to_user.last_name || ""}`.trim()
                                : invite.to_email}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Joined on{" "}
                              {new Date(invite.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {getStatusBadge("accepted")}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="rejected" className="mt-0">
                  {rejectedInvitations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <X className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No declined invitations</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rejectedInvitations.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-red-50 dark:bg-red-950/20"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-red-200 text-red-800">
                              {getInitials(
                                invite.to_user?.first_name || null,
                                invite.to_user?.last_name || null,
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">
                              {invite.to_user
                                ? `${invite.to_user.first_name || ""} ${invite.to_user.last_name || ""}`.trim()
                                : invite.to_email}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Declined invitation
                            </p>
                          </div>
                          {getStatusBadge("rejected")}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </section>
      )}

      {/* Create Team Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-h-[95dvh] overflow-y-auto sm:max-w-md sm:h-auto sm:rounded-lg bg-white backdrop-blur-md border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg">Create Your Team</DialogTitle>
            <DialogDescription>
              Set up your team to start inviting runners and registering for
              races.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">
                Team Name <span className="text-accent">*</span>
              </Label>
              <Input
                id="team-name"
                placeholder="Enter team name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className=""
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-description">
                Description{" "}
                <span className="text-muted-foreground text-xs font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="team-description"
                placeholder="Brief description of your team..."
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Team Logo{" "}
                <span className="text-muted-foreground text-xs font-normal">
                  (optional)
                </span>
              </Label>
              <TeamLogoUpload
                currentLogoUrl={createLogoUrl}
                onUploadComplete={setCreateLogoUrl}
                size="md"
              />
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border p-3 ">
              <Checkbox
                id="create-high-school"
                checked={teamIsHighSchool}
                onCheckedChange={(checked) => setTeamIsHighSchool(!!checked)}
                className="border-black data-[state=checked]:bg-black data-[state=checked]:border-black cursor-pointer"
              />
              <Label
                htmlFor="create-high-school"
                className="cursor-pointer flex items-center gap-1.5 text-sm"
              >
                Are you a High School Team?
              </Label>
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              variant="outline"
              className="bg-transparent"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={isCreating}
              className="bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer "
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Team
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Runner</DialogTitle>
            <DialogDescription>
              Send an invitation by email or generate a shareable link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Method Tabs */}
            <Tabs
              value={inviteMethod}
              onValueChange={(v) => setInviteMethod(v as "email" | "link")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="link">
                  <Link2 className="h-4 w-4 mr-2" />
                  Link
                </TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="runner@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
              </TabsContent>

              <TabsContent value="link" className="space-y-4 mt-4">
                {generatedLink ? (
                  <div className="space-y-2">
                    <Label>Shareable Link</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={generatedLink}
                        className="bg-muted"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        className="bg-transparent"
                        onClick={() => copyToClipboard(generatedLink)}
                      >
                        {linkCopied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Share this link with the runner. Anyone with this link can
                      join your team.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Link2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Generate a link that can be shared with anyone to join
                      your team.
                    </p>
                    <Button
                      onClick={handleGenerateLink}
                      disabled={isInviting}
                      variant="outline"
                      className="bg-transparent cursor-pointer"
                    >
                      {isInviting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4 mr-2" />
                      )}
                      Generate Link
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="bg-transparent cursor-pointer"
              onClick={() => setInviteDialogOpen(false)}
            >
              Cancel
            </Button>
            {inviteMethod === "email" && (
              <Button
                className="bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer "
                onClick={handleInviteByEmail}
                disabled={isInviting || !inviteEmail}
              >
                {isInviting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Invite
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Team Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Team
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete{" "}
                <span className="font-semibold">{myTeam?.name}</span>?
              </p>
              <p className="text-destructive/80">
                This action cannot be undone. All team members will be removed
                and any pending invitations will be cancelled.
              </p>
              {myTeam && (myTeam.memberDetails?.length || 0) > 0 && (
                <p className="text-sm bg-destructive/10 p-2 rounded border border-destructive/20">
                  This team has {myTeam.memberDetails?.length} member
                  {(myTeam.memberDetails?.length || 0) !== 1 ? "s" : ""} who
                  will be notified of the deletion.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTeam}
              disabled={isDeleting}
              className="bg-destructive text-white cursor-pointer hover:bg-red-700 "
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Team
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog
        open={removeMemberDialogOpen}
        onOpenChange={setRemoveMemberDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold">
                {memberToRemove?.first_name || ""}{" "}
                {memberToRemove?.last_name || "this runner"}
              </span>{" "}
              from your team? They will need to be re-invited to join again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <UserMinus className="h-4 w-4 mr-2" />
                  Remove Member
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Member Dialog */}
      <Dialog
        open={viewMemberDialogOpen}
        onOpenChange={setViewMemberDialogOpen}
      >
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Runner Details</DialogTitle>
            <DialogDescription>
              Complete information for this team member
            </DialogDescription>
          </DialogHeader>
          {viewMember && (
            <div className="space-y-4">
              {/* Header with avatar */}
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-lg">
                    {getInitials(viewMember.first_name, viewMember.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">
                    {viewMember.first_name || ""}{" "}
                    {viewMember.last_name || "Runner"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {viewMember.email}
                  </p>
                </div>
              </div>

              {/* Basic info grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <Badge
                    variant="outline"
                    className={getGenderBadgeColor(viewMember.gender)}
                  >
                    {viewMember.gender || "Not specified"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Age</p>
                  <p className="font-medium">{viewMember.age || "-"}</p>
                </div>
              </div>

              {/* Address */}
              {viewMember.address && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Address
                  </p>
                  <p className="font-medium">
                    {viewMember.address.street && (
                      <span>
                        {viewMember.address.street}
                        <br />
                      </span>
                    )}
                    {[
                      viewMember.address.city,
                      viewMember.address.state,
                      viewMember.address.zipCode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              )}

              {/* Past achievements */}
              {viewMember.past_achievements && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Past Achievements
                  </p>
                  <p className="font-medium text-sm">
                    {viewMember.past_achievements}
                  </p>
                </div>
              )}

              {/* Disabilities */}
              {viewMember.disabilities && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Disabilities/Accommodations
                  </p>
                  <p className="font-medium text-sm">
                    {viewMember.disabilities}
                  </p>
                </div>
              )}

              {/* Member since */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-medium text-sm">
                    {new Date(viewMember.created_at).toLocaleDateString()}
                  </p>
                </div>
                {viewMember.updated_at && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Last Updated
                    </p>
                    <p className="font-medium text-sm">
                      {new Date(viewMember.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="bg-transparent"
              onClick={() => setViewMemberDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assistant Managers section moved above Available Runners */}
      {false && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Assistant Managers</h2>
              <p className="text-sm text-muted-foreground">
                Assign team members to help manage runners and view payments.
                They cannot remove you.
              </p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm"
                      onClick={() => setAmDialogOpen(true)}
                      className="bg-[#EE0505] hover:bg-red-700"
                      disabled={
                        !myTeam.memberDetails ||
                        myTeam.memberDetails.length === 0 ||
                        localAMs.length > 0
                      }
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Assign AM
                    </Button>
                  </span>
                </TooltipTrigger>
                {localAMs.length > 0 && (
                  <TooltipContent>
                    Remove the current AM before assigning a new one.
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>

          {localAMs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              No assistant managers assigned yet.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Email
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Assigned
                    </TableHead>
                    <TableHead className="text-right">Remove</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localAMs.map((am) => (
                    <TableRow key={am.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-orange-500/10 text-orange-600 text-xs">
                              {`${am.user?.first_name?.charAt(0) || ""}${am.user?.last_name?.charAt(0) || ""}`.toUpperCase() ||
                                "AM"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {am.user?.first_name} {am.user?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground sm:hidden">
                              {am.user?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {am.user?.email}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {new Date(am.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setAmToRemove(am);
                            setRemoveAMDialogOpen(true);
                          }}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Assign AM Dialog */}
      {/* Assign AM Dialog */}
      <Dialog open={amDialogOpen} onOpenChange={setAmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-full bg-red-50 border border-red-100">
                <Users className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-base">
                  Assign Assistant Manager
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Grant a team member assistant manager permissions.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground bg-muted/50 border rounded-lg px-3 py-2">
              Assistant managers can add/remove runners and view payments but
              cannot manage finances.
            </p>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Team Member</Label>
              <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
                {(myTeam?.memberDetails || [])
                  .filter((m) => !localAMs.some((am) => am.user_id === m.id))
                  .map((m) => {
                    const initials =
                      `${m.first_name?.[0] ?? ""}${m.last_name?.[0] ?? ""}`.toUpperCase();
                    const isSelected = amMemberId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAmMemberId(m.id)}
                        className={`flex items-center gap-3 w-full p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                          isSelected
                            ? "border-red-500 bg-red-50"
                            : "border-border hover:border-red-200 hover:bg-muted/40"
                        }`}
                      >
                        <div
                          className={`flex items-center justify-center h-9 w-9 rounded-full text-sm font-semibold shrink-0 ${
                            isSelected
                              ? "bg-red-500 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {initials || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {m.first_name} {m.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {m.email}
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="bg-transparent cursor-pointer"
              onClick={() => setAmDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignAM}
              disabled={isAssigningAM || !amMemberId}
              className="bg-[#EE0505] hover:bg-red-700 cursor-pointer"
            >
              {isAssigningAM && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove AM Confirm */}
      <AlertDialog
        open={removeAMDialogOpen}
        onOpenChange={setRemoveAMDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assistant Manager</AlertDialogTitle>
            <AlertDialogDescription>
              Remove{" "}
              <span className="font-semibold">
                {amToRemove?.user?.first_name} {amToRemove?.user?.last_name}
              </span>{" "}
              as assistant manager? They will remain a team member but lose
              manager permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveAM}
              disabled={isRemovingAM}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemovingAM && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
