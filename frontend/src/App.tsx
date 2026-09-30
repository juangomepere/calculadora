import { Calculator } from './components/Calculator';
import { calculateForUi } from './calculate';

export default function App() {
  return (
    <main className="app">
      <Calculator onCalculate={calculateForUi} />
    </main>
  );
}
