import { discoverAndScrape } from '../services/api'
import { useState } from 'react'

function MenuView() {
  const [name, setName] = useState('')
  const [menu, setMenu] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const token = localStorage.getItem('token')

  const handleSearch = async () => {
    try {
      setLoading(true)
      setError(null)

      const result = await discoverAndScrape(name, token)

      setMenu(result.menu_sections)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter restaurant name"
      />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? 'Searching...' : 'Find Menu'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {menu && menu.map((section, i) => (
        <div key={i}>
          <h2>{section.title}</h2>
          <ul>
            {section.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default MenuView
