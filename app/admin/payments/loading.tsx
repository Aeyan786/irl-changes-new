import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-4 lg:flex-row">
            <Skeleton className="h-10 flex-1" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>

          {/* Table rows */}
          <div className="space-y-3 rounded-md border p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32 hidden md:block" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-12 hidden sm:block" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-4 w-20 hidden lg:block" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
