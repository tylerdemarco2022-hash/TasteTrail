export default function TermsOfUse({ onClose }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-gray-900">Terms of Use</h2>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-800">Close</button>
        </div>
        <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
          <p>TasteTrails is a guide to restaurants and dishes. Menus, prices, hours, and dietary labels can be incomplete or out of date. Confirm details with the restaurant before you order, especially for allergies and dietary needs.</p>
          <p>You are responsible for the reviews and photos you post. Don’t post anyone else’s private information.</p>
          <p>The app is provided as-is. Restaurant reservations made through third-party links are handled by those services, not by TasteTrails.</p>
          <p>You can stop using the app and delete your account at any time in Settings.</p>
        </div>
      </div>
    </div>
  )
}
