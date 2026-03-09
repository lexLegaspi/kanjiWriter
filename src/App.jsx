import { useState } from 'react'
import './App.css'

function App() {
  // 1. Setup State: Holds an array of objects like { text: "Buy milk", completed: false }
  const [tasks, setTasks] = useState([]);
  
  // State for the input box value
  const [inputValue, setInputValue] = useState("");

  // Function to add a new task
  const addTask = (e) => {
    e.preventDefault(); // Prevent page reload when hitting Enter
    
    if (!inputValue.trim()) return; // Don't add empty tasks

    const newTask = {
      id: Date.now(), // Generate unique ID based on timestamp
      text: inputValue,
      completed: false
    };

    setTasks([...tasks, newTask]);
    setInputValue(""); // Clear input field
  };

  // Function to delete a task
  const deleteTask = (id) => {
    // Filter the array to remove the item matching the ID
    setTasks(tasks.filter(task => task.id !== id));
  };

  // Function to toggle "completed" status
  const toggleTask = (id) => {
    setTasks(
      tasks.map(task => 
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  return (
    <div className="container">
      <h1>📝 To-Do List</h1>
      
      {/* Add Task Section */}
      <form onSubmit={addTask} className="task-form">
        <input 
          type="text" 
          placeholder="What needs to be done?" 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>

      {/* List Section */}
      <ul className="task-list">
        {tasks.length === 0 && <p className="no-tasks">No tasks yet! Add one above.</p>}
        
        {tasks.map((task) => (
          <li key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
            <input 
              type="checkbox" 
              checked={task.completed}
              onChange={() => toggleTask(task.id)}
            />
            <span>{task.text}</span>
            <button onClick={() => deleteTask(task.id)}>✕</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App
