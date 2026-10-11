export default function PrivacyPolicy({ onClose }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-gray-900">Privacy Policy</h2>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-800">Close</button>
        </div>
        <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
          <p>TasteTrails helps you find restaurants and menu items. This policy describes what the app handles on this device and what a connected account stores.</p>
          <div>
            <h3 className="font-semibold text-gray-900">Account</h3>
            <p>If you create an account, we store your name, email, and a password hash so you can sign in. You can delete the account from Settings → Account → Delete Account Permanently. Deletion removes the account on the server when the request succeeds, and clears profile, ratings, and saved preferences stored on this device.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Location</h3>
            <p>Location is used only after you tap “Use my location,” to sort and filter menu items by distance. Until then, search uses a Charlotte, NC starting point. The app does not track location in the background.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Camera and photos</h3>
            <p>Camera and photo library access are optional. They are used when you add a profile photo or a photo of a dish. Photos you pick stay in the app’s local storage unless a signed-in request uploads them.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Preferences</h3>
            <p>Dietary choices, theme, and notification settings are saved on this device and used to filter or label menu items. Dietary labels are estimates from menu text, not a guarantee from the kitchen.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">What we don’t do</h3>
            <p>TasteTrails does not sell personal information and does not use advertising tracking. The App Store listing’s privacy policy URL should point at the public copy of this policy once you host it.</p>
          </div>
          <p className="text-xs text-gray-500">Last updated October 11, 2026.</p>
        </div>
      </div>
    </div>
  )
}
