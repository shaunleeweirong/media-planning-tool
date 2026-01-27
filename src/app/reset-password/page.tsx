import { ResetPasswordForm } from './reset-password-form'

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Set new password</h1>
          <p className="text-muted-foreground">Enter your new password below</p>
        </div>
        <ResetPasswordForm />
      </div>
    </main>
  )
}
