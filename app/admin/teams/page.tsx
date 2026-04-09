"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
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
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  School,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from "lucide-react"
import { TeamLogo } from "@/components/team-logo"

interface Team {
  id: string
  name: string
  manager_id: string
  members: string[]
  details?: string | null
  is_high_school?: boolean
  logo_url?: string | null
  created_at: string
  updated_at?: string | null
  manager?: {
    first_name: string | null
    last_name: string | null
    email: string
  }
}

const ITEMS_PER_PAGE = 10

export default function AdminTeamsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "")
  const [currentPage, setCurrentPage] = useState(1)

  // Keep in sync when header pushes a new ?q= param
  useEffect(() => {
    setSearchQuery(searchParams.get("q") ?? "")
    setCurrentPage(1)
  }, [searchParams])

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [createIsHighSchool, setCreateIsHighSchool] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editTeam, setEditTeam] = useState<Team | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editIsHighSchool, setEditIsHighSchool] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchTeams()
  }, [])

  // Handle ?edit=teamId coming back from detail page
  useEffect(() => {
    const editId = searchParams.get("edit")
    if (editId && teams.length > 0) {
      const team = teams.find((t) => t.id === editId)
      if (team) openEditDialog(team)
    }
  }, [searchParams, teams])

  const fetchTeams = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("teams")
      .select(`
        *,
        manager:users!teams_manager_id_fkey(first_name, last_name, email)
      `)
      .order("created_at", { ascending: false })

    if (error) {
      toast({ title: "Error", description: "Failed to fetch teams", variant: "destructive" })
    } else {
      setTeams(data || [])
    }
    setLoading(false)
  }

  const filteredTeams = useMemo(() => {
    if (!searchQuery) return teams
    const q = searchQuery.toLowerCase()
    return teams.filter((t) => {
      const managerName = `${t.manager?.first_name || ""} ${t.manager?.last_name || ""}`.toLowerCase()
      return (
        t.name.toLowerCase().includes(q) ||
        managerName.includes(q) ||
        (t.manager?.email || "").toLowerCase().includes(q)
      )
    })
  }, [teams, searchQuery])

  const totalPages = Math.ceil(filteredTeams.length / ITEMS_PER_PAGE)
  const paginatedTeams = filteredTeams.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const handleCreateTeam = async () => {
    if (!createName.trim()) {
      toast({ title: "Team name required", description: "Please enter a name.", variant: "destructive" })
      return
    }
    setIsCreating(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsCreating(false); return }

    const { error } = await supabase.from("teams").insert({
      name: createName.trim(),
      details: createDescription.trim() || null,
      is_high_school: createIsHighSchool,
      manager_id: user.id,
      members: [],
    })

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } else {
      toast({ title: "Team created", description: `"${createName}" has been created.` })
      setCreateDialogOpen(false)
      setCreateName("")
      setCreateDescription("")
      setCreateIsHighSchool(false)
      fetchTeams()
    }
    setIsCreating(false)
  }

  const openEditDialog = (team: Team) => {
    setEditTeam(team)
    setEditName(team.name)
    setEditDescription(team.details || "")
    setEditIsHighSchool(team.is_high_school || false)
    setEditDialogOpen(true)
  }

  const handleUpdateTeam = async () => {
    if (!editTeam || !editName.trim()) return
    setIsUpdating(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("teams")
      .update({
        name: editName.trim(),
        details: editDescription.trim() || null,
        is_high_school: editIsHighSchool,
        // logo_url intentionally not changed here — managed by the team manager
      })
      .eq("id", editTeam.id)

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } else {
      toast({ title: "Team updated", description: `"${editName}" has been updated.` })
      setTeams((prev) =>
        prev.map((t) =>
          t.id === editTeam.id
            ? { ...t, name: editName.trim(), details: editDescription.trim() || null, is_high_school: editIsHighSchool, logo_url: t.logo_url }
            : t
        )
      )
      setEditDialogOpen(false)
    }
    setIsUpdating(false)
  }

  const handleDeleteTeam = async () => {
    if (!teamToDelete) return
    setIsDeleting(true)
    const supabase = createClient()

    // Clear current_team_id for all members
    if (teamToDelete.members?.length > 0) {
      await supabase
        .from("users")
        .update({ current_team_id: null })
        .in("id", teamToDelete.members)
    }

    // Delete related invitations
    await supabase.from("invitations").delete().eq("team_id", teamToDelete.id)

    const { error } = await supabase.from("teams").delete().eq("id", teamToDelete.id)

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } else {
      toast({ title: "Team deleted", description: `"${teamToDelete.name}" has been deleted.` })
      setTeams((prev) => prev.filter((t) => t.id !== teamToDelete.id))
      setDeleteDialogOpen(false)
      setTeamToDelete(null)
    }
    setIsDeleting(false)
  }

  const getInitials = (firstName: string | null, lastName: string | null) =>
    `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?"

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground text-balance">Team Management</h1>
          <p className="text-muted-foreground mt-1">
            View, edit, and manage all teams on the platform
          </p>
        </div>
        <Button
          className="bg-[#FF0000] hover:bg-red-700 hover:shadow-sm  cursor-pointer"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
                 <div className="rounded-full bg-red-500/10 p-3">
                <Users className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teams.length}</p>
                <p className="text-sm text-muted-foreground">Total Teams</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-500/10 p-3">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {teams.reduce((sum, t) => sum + (t.members?.length || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md hidden sm:block">
  <CardContent className="p-4">
    <div className="flex items-center gap-4">
      <div className="rounded-full bg-green-500/10 p-3">
        <Users className="h-5 w-5 text-green-600" />
      </div>
      <div>
        <p className="text-2xl font-bold">
          {teams.reduce((sum, t) => sum + (t.members?.length || 0), 0)}
        </p>
        <p className="text-sm text-muted-foreground">Total Runners</p>
      </div>
    </div>
  </CardContent>
</Card>
      </div>

      {/* Teams List */}
      <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <CardHeader>
          <CardTitle>All Teams</CardTitle>
          <CardDescription>
            {filteredTeams.length} of {teams.length} teams
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search teams or managers..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                className="pl-10"
              />
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTeams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No teams found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTeams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <TeamLogo logoUrl={team.logo_url} teamName={team.name} size={32} />
                          <span className="flex items-center gap-1.5">
                            {team.is_high_school && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <GraduationCap className="h-4 w-4 text-accent flex-shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent>High School Team</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {team.name}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>
                        {team.manager ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {getInitials(team.manager.first_name, team.manager.last_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {team.manager.first_name} {team.manager.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {team.manager.email}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{team.members?.length || 0} runners</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(team.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button className="cursor-pointer" variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="cursor-pointer" onClick={() => router.push(`/admin/teams/${team.id}`)}>
                              <Users className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => openEditDialog(team)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit Team
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive cursor-pointer"
                              onClick={() => { setTeamToDelete(team); setDeleteDialogOpen(true) }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Team
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
            {paginatedTeams.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No teams found</div>
            ) : (
              paginatedTeams.map((team) => (
                <Card key={team.id} className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold flex items-center gap-2">
                          <TeamLogo logoUrl={team.logo_url} teamName={team.name} size={28} />
                          <span className="flex items-center gap-1.5">
                            {team.is_high_school && (
                              <School className="h-4 w-4 text-accent flex-shrink-0" />
                            )}
                            {team.name}
                          </span>
                        </p>
                        {team.manager && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            Manager: {team.manager.first_name} {team.manager.last_name}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {team.members?.length || 0} runners
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(team.created_at)}
                          </span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/admin/teams/${team.id}`)}>
                            <Users className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(team)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { setTeamToDelete(team); setDeleteDialogOpen(true) }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredTeams.length)} of {filteredTeams.length}
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

      {/* Create Team Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md dark:bg-gray-900/80 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
            <DialogDescription>Create a new team as an admin override.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-team-name">Team Name <span className="text-accent">*</span></Label>
              <Input
                id="admin-team-name"
                placeholder="Enter team name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-team-desc">Description <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="admin-team-desc"
                placeholder="Brief description..."
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border p-3">
              <Checkbox
                id="admin-hs"
                checked={createIsHighSchool}
                onCheckedChange={(c) => setCreateIsHighSchool(!!c)}
                className="border-black cursor-pointer data-[state=checked]:bg-black data-[state=checked]:border-accent"
              />
              <Label htmlFor="admin-hs" className="cursor-pointer flex items-center gap-1.5 text-sm">
                High School Team
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer bg-white" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateTeam}
              disabled={isCreating}
              className="bg-[#EE0505] hover:bg-red-700 hover:shadow-lg  cursor-pointer"
            >
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>Update team details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-team-name">Team Name <span className="text-accent">*</span></Label>
              <Input
                id="edit-team-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team-desc">Description</Label>
              <Textarea
              placeholder="Write team description..."
                id="edit-team-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border p-3">
              <Checkbox
                id="edit-hs"
                checked={editIsHighSchool}
                onCheckedChange={(c) => setEditIsHighSchool(!!c)}
              className="border-black cursor-pointer data-[state=checked]:bg-black data-[state=checked]:border-accent"
              />
             <Label htmlFor="admin-hs" className="cursor-pointer flex items-center gap-1.5 text-sm">
                High School Team
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="bg-white cursor-pointer" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleUpdateTeam}
              disabled={isUpdating}
                          className="bg-[#EE0505] hover:bg-red-700 hover:shadow-lg  cursor-pointer"

            >
              {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete{" "}
                <span className="font-semibold">{teamToDelete?.name}</span>?
              </p>
              <p>
                This will remove all {teamToDelete?.members?.length || 0} members from the team
                and clear their team assignment. This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTeam}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
