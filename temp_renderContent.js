  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardScreen navigation={{ navigate: setActiveTab }} />;
      case 'history':
        return <SessionHistoryScreen navigation={{ navigate: setActiveTab }} />;
      case 'training':
        return <TrainingSessionScreen navigation={{ navigate: setActiveTab, goBack: () => setActiveTab('dashboard') }} />;
      default:
        return <DashboardScreen navigation={{ navigate: setActiveTab }} />;
    }
  };
