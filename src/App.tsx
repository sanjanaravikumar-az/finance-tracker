import { useEffect, useState } from 'react';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import { signIn, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { uploadData, getUrl } from 'aws-amplify/storage';
import awsconfig from './aws-exports';
import './App.css';

Amplify.configure(awsconfig);
const client = generateClient();

// GraphQL queries and mutations
const listTransactions = /* GraphQL */ `
  query ListTransactions {
    listTransactions {
      items {
        id
        description
        amount
        type
        category
        date
        receiptUrl
      }
    }
  }
`;

const createTransaction = /* GraphQL */ `
  mutation CreateTransaction($input: CreateTransactionInput!) {
    createTransaction(input: $input) {
      id
      description
      amount
      type
      category
      date
      receiptUrl
    }
  }
`;

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  date: string;
  receiptUrl?: string;
}

interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRate: string;
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [category, setCategory] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  useEffect(() => {
    if (transactions.length > 0) {
      calculateSummary();
    }
  }, [transactions]);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      console.log('Not signed in');
    }
  };

  const handleSignIn = async () => {
    try {
      await signIn({ username: 'testuser', password: 'TestPassword123!' });
      await checkUser();
    } catch (error) {
      console.error('Error signing in:', error);
      alert('Sign in failed. Using demo mode.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setTransactions([]);
      setSummary(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const result: any = await client.graphql({ query: listTransactions });
      setTransactions(result.data.listTransactions.items);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description || !amount || !category) {
      alert('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      
      let receiptUrl = '';
      
      // Upload receipt to S3 if file is selected
      if (receiptFile) {
        const fileName = `receipts/${Date.now()}-${receiptFile.name}`;
        const result = await uploadData({
          path: fileName,
          data: receiptFile,
        }).result;
        
        // Get the URL for the uploaded file
        const urlResult = await getUrl({ path: fileName });
        receiptUrl = urlResult.url.toString();
      }

      const input = {
        description,
        amount: parseFloat(amount),
        type,
        category,
        date: new Date().toISOString(),
        receiptUrl: receiptUrl || undefined,
      };

      await client.graphql({
        query: createTransaction,
        variables: { input },
      });

      // Reset form
      setDescription('');
      setAmount('');
      setCategory('');
      setReceiptFile(null);
      
      // Refresh transactions
      await fetchTransactions();
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = async () => {
    try {
      // Call Lambda function for calculations
      const session = await fetchAuthSession();
      const apiEndpoint = awsconfig.aws_cloud_logic_custom?.[0]?.endpoint;
      
      if (apiEndpoint) {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ transactions }),
        });
        
        const data = await response.json();
        setSummary(data);
      } else {
        // Fallback calculation if Lambda not configured
        const localSummary = transactions.reduce(
          (acc, t) => {
            if (t.type === 'INCOME') {
              acc.totalIncome += t.amount;
            } else {
              acc.totalExpenses += t.amount;
            }
            return acc;
          },
          { totalIncome: 0, totalExpenses: 0, balance: 0, savingsRate: '0' }
        );
        localSummary.balance = localSummary.totalIncome - localSummary.totalExpenses;
        localSummary.savingsRate = localSummary.totalIncome > 0
          ? ((localSummary.balance / localSummary.totalIncome) * 100).toFixed(2)
          : '0';
        setSummary(localSummary);
      }
    } catch (error) {
      console.error('Error calculating summary:', error);
    }
  };

  if (!user) {
    return (
      <div className="app-container">
        <h1>💰 Finance Tracker</h1>
        <div className="auth-container">
          <p>Please sign in to access your finance tracker</p>
          <button onClick={handleSignIn} className="btn-primary">
            Sign In
          </button>
          <p className="demo-note">
            Demo: Uses Amplify Auth, API (GraphQL), Storage (S3), and Lambda
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>💰 Finance Tracker</h1>
        <div className="user-info">
          <span>Welcome, {user.username}</span>
          <button onClick={handleSignOut} className="btn-secondary">
            Sign Out
          </button>
        </div>
      </header>

      {summary && (
        <div className="summary-cards">
          <div className="card income">
            <h3>Total Income</h3>
            <p className="amount">${summary.totalIncome.toFixed(2)}</p>
          </div>
          <div className="card expense">
            <h3>Total Expenses</h3>
            <p className="amount">${summary.totalExpenses.toFixed(2)}</p>
          </div>
          <div className="card balance">
            <h3>Balance</h3>
            <p className="amount">${summary.balance.toFixed(2)}</p>
          </div>
          <div className="card savings">
            <h3>Savings Rate</h3>
            <p className="amount">{summary.savingsRate}%</p>
          </div>
        </div>
      )}

      <div className="main-content">
        <div className="form-section">
          <h2>Add Transaction</h2>
          <form onSubmit={handleAddTransaction}>
            <div className="form-group">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as 'INCOME' | 'EXPENSE')}>
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
            </div>

            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Grocery shopping"
              />
            </div>

            <div className="form-group">
              <label>Amount</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Food, Salary, Entertainment"
              />
            </div>

            <div className="form-group">
              <label>Receipt (Optional - S3 Storage)</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Transaction'}
            </button>
          </form>
        </div>

        <div className="transactions-section">
          <h2>Recent Transactions</h2>
          {loading && <p>Loading...</p>}
          {transactions.length === 0 && !loading && (
            <p className="empty-state">No transactions yet. Add your first one!</p>
          )}
          <div className="transactions-list">
            {transactions.map((transaction) => (
              <div key={transaction.id} className={`transaction-item ${transaction.type.toLowerCase()}`}>
                <div className="transaction-info">
                  <h4>{transaction.description}</h4>
                  <p className="category">{transaction.category}</p>
                  <p className="date">{new Date(transaction.date).toLocaleDateString()}</p>
                  {transaction.receiptUrl && (
                    <a href={transaction.receiptUrl} target="_blank" rel="noopener noreferrer" className="receipt-link">
                      📎 View Receipt
                    </a>
                  )}
                </div>
                <div className="transaction-amount">
                  <span className={transaction.type === 'INCOME' ? 'positive' : 'negative'}>
                    {transaction.type === 'INCOME' ? '+' : '-'}${transaction.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="app-footer">
        <p>
          🔧 Powered by: Amplify Auth • GraphQL API • S3 Storage • Lambda Functions • Custom Resources
        </p>
      </footer>
    </div>
  );
}

export default App;
