import { Skeleton } from "@/components/ui/skeleton"
import Image from "next/image"

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white">
      <div className="space-y-4 text-center">
        {/* Animated runner */}
        <div className="relative mx-auto h-16 w-16">
       
          <Image src={'/icons8-running.gif'} width={400} height={400} alt="runner is tired"/>
        </div>
        
        {/* Loading Text */}
        <div className="space-y-2">
         
        </div>
      </div>
    </div>
  )
}
