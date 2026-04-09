"use client"

import { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Users,
  User,
  UserPlus,
  Shield,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Eye,
  ArrowRightLeft,
  ChevronDown,
  KeyRound,
  UserX,
} from "lucide-react"

interface TeamInfo {
  id: string
  name: string
}

interface UserData {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: "runner" | "manager" | "admin"
  gender: string | null
  age: number | null
  address: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
  } | null
  past_achievements: string | null
  disabilities: string | null
  current_team_id: string | null
  created_at: string
  updated_at: string | null
  team?: TeamInfo | null
  managedTeams?: TeamInfo[]
}

const ITEMS_PER_PAGE = 10

export default function AdminUsersPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserData[]>([])
  const [teams, setTeams] = useState<TeamInfo[]>([])
  const searchParams = useSearchParams()

  // Search and filter — initialise from header search (?q=)
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [genderFilter, setGenderFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)

  // Keep in sync when header pushes a new ?q= param
  useEffect(() => {
    setSearchQuery(searchParams.get("q") ?? "")
    setCurrentPage(1)
  }, [searchParams])

  // Expanded mobile cards
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  // View dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserData | null>(null)
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    role: "runner" as "runner" | "manager" | "admin",
    age: "",
    gender: "other" as string,
  })
  const [isUpdating, setIsUpdating] = useState(false)

  // Change role dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [roleUser, setRoleUser] = useState<UserData | null>(null)
  const [newRole, setNewRole] = useState<string>("")
  const [isChangingRole, setIsChangingRole] = useState(false)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const totalRunners = users.filter((u) => u.role === "runner").length
  const totalManagers = users.filter((u) => u.role === "manager").length

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const supabase = createClient()

    // Fetch all non-admin users
    const { data: usersData, error } = await supabase
      .from("users")
      .select("*")
      .neq("role", "admin")
      .order("created_at", { ascending: false })

    // Fetch teams for lookup (includes manager_id to determine managed teams)
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name, manager_id")

    if (error) {
      toast({ title: "Error", description: "Failed to fetch users", variant: "destructive" })
    } else {
      const teamMap = new Map((teamsData || []).map((t) => [t.id, { id: t.id, name: t.name }]))

      // Build a map of manager_id -> managed teams
      const managerTeamsMap = new Map<string, TeamInfo[]>()
      for (const t of teamsData || []) {
        if (t.manager_id) {
          const existing = managerTeamsMap.get(t.manager_id) || []
          existing.push({ id: t.id, name: t.name })
          managerTeamsMap.set(t.manager_id, existing)
        }
      }

      const enriched = (usersData || []).map((u) => ({
        ...u,
        team: u.current_team_id ? teamMap.get(u.current_team_id) || null : null,
        managedTeams: u.role === "manager" ? managerTeamsMap.get(u.id) || [] : [],
      }))
      setUsers(enriched)
      setTeams((teamsData || []).map(t => ({ id: t.id, name: t.name })))
    }
    setLoading(false)
  }

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName = `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase()
      const matchesSearch =
        searchQuery === "" ||
        fullName.includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.team?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
      const matchesRole = roleFilter === "all" || user.role === roleFilter
      const matchesGender = genderFilter === "all" || user.gender === genderFilter
      return matchesSearch && matchesRole && matchesGender
    })
  }, [users, searchQuery, roleFilter, genderFilter])

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const handleOpenEdit = (user: UserData) => {
    setEditUser(user)
    setEditForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      role: user.role,
      age: user.age?.toString() || "",
      gender: user.gender || "male",
    })
    setEditDialogOpen(true)
  }

  const handleUpdateUser = async () => {
    if (!editUser) return
    setIsUpdating(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("users")
      .update({
        first_name: editForm.first_name || null,
        last_name: editForm.last_name || null,
        role: editForm.role,
        age: editForm.age ? Number.parseInt(editForm.age, 10) : null,
        gender: editForm.gender,
      })
      .eq("id", editUser.id)

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } else {
      toast({ title: "User updated", description: "User details have been updated." })
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editUser.id
            ? {
                ...u,
                first_name: editForm.first_name || null,
                last_name: editForm.last_name || null,
                role: editForm.role,
                age: editForm.age ? Number.parseInt(editForm.age, 10) : null,
                gender: editForm.gender,
              }
            : u
        )
      )
      setEditDialogOpen(false)
    }
    setIsUpdating(false)
  }

  const handleChangeRole = async () => {
    if (!roleUser || !newRole || newRole === roleUser.role) return
    setIsChangingRole(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("users")
      .update({ role: newRole })
      .eq("id", roleUser.id)

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } else {
      toast({
        title: "Role changed",
        description: `${roleUser.first_name}'s role changed to ${newRole}.`,
      })
      setUsers((prev) =>
        prev.map((u) =>
          u.id === roleUser.id ? { ...u, role: newRole as "runner" | "manager" | "admin" } : u
        )
      )
      setRoleDialogOpen(false)
    }
    setIsChangingRole(false)
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    setIsDeleting(true)
    const supabase = createClient()

    const { error } = await supabase.from("users").delete().eq("id", userToDelete.id)

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } else {
      toast({ title: "User deleted", description: `${userToDelete.first_name} ${userToDelete.last_name} has been removed.` })
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id))
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    }
    setIsDeleting(false)
  }
const handleResetPassword = async (user: UserData) => {
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } else {
      toast({ title: "Reset email sent", description: `Password reset email sent to ${user.email}.` })
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            <Shield className="mr-1 h-3 w-3" />
            Admin
          </Badge>
        )
      case "manager":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            <UserPlus className="mr-1 h-3 w-3" />
            Manager
          </Badge>
        )
      case "assistant_manager":
        return (
          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
            <UserPlus className="mr-1 h-3 w-3" />
            Asst. Manager
          </Badge>
        )
      default:
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            <User className="mr-1 h-3 w-3" />
            Runner
          </Badge>
        )
    }
  }

  const getInitials = (firstName: string | null, lastName: string | null) =>
    `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "U"

  const formatAddress = (address: UserData["address"]) => {
    if (!address) return "-"
    const parts = [address.city, address.state].filter(Boolean)
    return parts.length > 0 ? parts.join(", ") : "-"
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground text-balance">All Users</h1>
        <p className="text-muted-foreground">
          Manage user accounts, roles, and permissions
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-3">
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-500/10 p-3">
                <User className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRunners}</p>
                <p className="text-sm text-muted-foreground">Runners</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-500/10 p-3">
                <UserPlus className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalManagers}</p>
                <p className="text-sm text-muted-foreground">Managers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <CardHeader>
          <CardTitle>User Directory</CardTitle>
          <CardDescription>
            {filteredUsers.length} of {users.length} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or team..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setCurrentPage(1) }}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="runner">Runner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="assistant_manager">Asst. Manager</SelectItem>
                </SelectContent>
              </Select>
              <Select value={genderFilter} onValueChange={(v) => { setGenderFilter(v); setCurrentPage(1) }}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Age</TableHead>
                  <TableHead className="hidden lg:table-cell">Gender</TableHead>
                  <TableHead className="hidden xl:table-cell">Address</TableHead>
                  <TableHead className="hidden xl:table-cell">Team</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(user.first_name, user.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground lg:hidden">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {user.age || "-"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell capitalize">
                        {user.gender || "-"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-muted-foreground">
                        {formatAddress(user.address)}
                      </TableCell>
                     <TableCell className="hidden xl:table-cell">
  {user.role === "runner" ? (
    user.team ? (
      <Badge
        variant="outline"
        className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20"
      >
        {user.team.name}
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="text-xs bg-green-500/10 text-green-600 border-green-500/20"
      >
        Available
      </Badge>
    )
  ) : user.role === "manager" ? (
    user.managedTeams && user.managedTeams.length > 0 ? (
      <div className="flex flex-wrap gap-1">
        {user.managedTeams.map((t) => (
          <Badge
            key={t.id}
            variant="outline"
            className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
          >
            {t.name}
          </Badge>
        ))}
      </div>
    ) : (
      <span className="text-muted-foreground text-sm">No teams</span>
    )
  ) : (
    <span className="text-muted-foreground text-sm">-</span>
  )}
</TableCell>
                      <TableCell className="hidden 2xl:table-cell text-sm text-muted-foreground">
                        {formatDate(user.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => { setSelectedUser(user); setViewDialogOpen(true) }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenEdit(user)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setRoleUser(user)
                                setNewRole(user.role)
                                setRoleDialogOpen(true)
                              }}
                            >
                              <ArrowRightLeft className="mr-2 h-4 w-4" />
                              Change Role
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleResetPassword(user)}
                            >
                              <KeyRound className="mr-2 h-4 w-4" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => { setUserToDelete(user); setDeleteDialogOpen(true) }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {paginatedUsers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No users found</div>
            ) : (
              paginatedUsers.map((user) => (
                <Card key={user.id} className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") setExpandedUserId(expandedUserId === user.id ? null : user.id) }}
                        role="button"
                        tabIndex={0}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(user.first_name, user.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {getRoleBadge(user.role)}
                            {user.team && (
                              <Badge variant="outline" className="text-xs">{user.team.name}</Badge>
                            )}
                          </div>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedUserId === user.id ? "rotate-180" : ""}`} />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedUser(user); setViewDialogOpen(true) }}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenEdit(user)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setRoleUser(user); setNewRole(user.role); setRoleDialogOpen(true) }}>
                            <ArrowRightLeft className="mr-2 h-4 w-4" /> Change Role
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                            <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => { setUserToDelete(user); setDeleteDialogOpen(true) }}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {expandedUserId === user.id && (
                      <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Age:</span>{" "}
                          <span className="font-medium">{user.age || "-"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Gender:</span>{" "}
                          <span className="font-medium capitalize">{user.gender || "-"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Location:</span>{" "}
                          <span className="font-medium">{formatAddress(user.address)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Updated:</span>{" "}
                          <span className="font-medium">{formatDate(user.updated_at)}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">Page {currentPage} of {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View User Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Complete user information</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {getInitials(selectedUser.first_name, selectedUser.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">
                    {selectedUser.first_name} {selectedUser.last_name}
                  </h3>
                  <p className="text-muted-foreground">{selectedUser.email}</p>
                  {getRoleBadge(selectedUser.role)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Age
                  </p>
                  <p className="font-medium">{selectedUser.age || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Gender
                  </p>
                  <p className="font-medium capitalize">{selectedUser.gender || "-"}</p>
                </div>
              </div>

              {selectedUser.address && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Address
                  </p>
                  <p className="font-medium">
                    {selectedUser.address.street && <span>{selectedUser.address.street}<br /></span>}
                    {[selectedUser.address.city, selectedUser.address.state, selectedUser.address.zipCode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              )}

              {selectedUser.team && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Team</p>
                  <Badge variant="outline">{selectedUser.team.name}</Badge>
                </div>
              )}

              {selectedUser.past_achievements && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Past Achievements</p>
                  <p className="font-medium">{selectedUser.past_achievements}</p>
                </div>
              )}

              {selectedUser.disabilities && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Disabilities/Accommodations</p>
                  <p className="font-medium">{selectedUser.disabilities}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-medium">{formatDate(selectedUser.created_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{formatDate(selectedUser.updated_at)}</p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" className="bg-transparent cursor-pointer" onClick={() => setViewDialogOpen(false)}>
                  Close
                </Button>
                <Button
                  className="bg-[#EE0505] hover:bg-red-700 hover:shadow-lg  cursor-pointer"
                  onClick={() => { setViewDialogOpen(false); handleOpenEdit(selectedUser) }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit User
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details and role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_first">First Name</Label>
                <Input
                  id="edit_first"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_last">Last Name</Label>
                <Input
                  id="edit_last"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_role">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm({ ...editForm, role: v as "runner" | "manager" | "admin" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="runner">Runner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_age">Age</Label>
              <Input
                id="edit_age"
                type="number"
                value={editForm.age}
                onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="bg-transparent cursor-pointer" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateUser}
              disabled={isUpdating}
              className="bg-[#EE0505] hover:bg-red-700 hover:shadow-lg  cursor-pointer"
            >
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Change role for {roleUser?.first_name} {roleUser?.last_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm flex gap-3 items-center text-muted-foreground">
              <span>

              Current role: 
              </span>
              <span>

              {getRoleBadge(roleUser?.role || "runner")}
              </span>
            </p>
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="runner">Runner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="bg-transparent cursor-pointer" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleChangeRole}
              disabled={isChangingRole || newRole === roleUser?.role}
              className="bg-[#EE0505] hover:bg-red-700 hover:shadow-lg  cursor-pointer"
            >
              {isChangingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {userToDelete?.first_name} {userToDelete?.last_name}
              </span>
              ? This action cannot be undone and will remove all associated data including
              team memberships, registrations, and results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
