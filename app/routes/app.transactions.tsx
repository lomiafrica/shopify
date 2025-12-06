import {
  Page,
  Layout,
  Card,
  DataTable,
  Filters,
  Button,
  ButtonGroup,
  BlockStack,
  Box,
  ChoiceList,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { useNavigate } from "@remix-run/react";

// TitleBar handled via <ui-title-bar> web component

export default function TransactionsPage() {
  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [queryValue, setQueryValue] = useState("");

  const handleStatusChange = useCallback(
    (value: string[]) => setSelectedStatus(value),
    [],
  );

  const handleFiltersQueryChange = useCallback(
    (value: string) => setQueryValue(value),
    [],
  );

  const handleStatusRemove = useCallback(() => setSelectedStatus([]), []);
  const handleQueryValueRemove = useCallback(() => setQueryValue(""), []);
  const handleClearAll = useCallback(() => {
    handleStatusRemove();
    handleQueryValueRemove();
  }, [handleStatusRemove, handleQueryValueRemove]);

  const handleBack = useCallback(() => {
    navigate("/app");
  }, [navigate]);

  const filters = [
    {
      key: "status",
      label: "Status",
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={[
            { label: "Pending", value: "pending" },
            { label: "Processing", value: "processing" },
            { label: "Completed", value: "completed" },
            { label: "Failed", value: "failed" },
          ]}
          selected={selectedStatus}
          onChange={handleStatusChange}
        />
      ),
      shortcut: true,
    },
  ];

  const rows = [
    ["#1234", "2024-02-08", "John Doe", "$100.00", "Completed"],
    ["#1235", "2024-02-08", "Jane Smith", "$75.50", "Pending"],
    ["#1236", "2024-02-08", "Bob Johnson", "$200.00", "Processing"],
  ];

  return (
    <Page
      fullWidth
      backAction={{
        content: "Back",
        onAction: handleBack,
      }}
    >
      <ui-title-bar title="Transactions" />
      <Layout>
        <Layout.Section>
          <Card roundedAbove="sm">
            <BlockStack gap="500">
              <Box padding="400">
                <Filters
                  queryValue={queryValue}
                  filters={filters}
                  onQueryChange={handleFiltersQueryChange}
                  onQueryClear={handleQueryValueRemove}
                  onClearAll={handleClearAll}
                />
              </Box>
              <Box padding="400">
                <DataTable
                  columnContentTypes={[
                    "text",
                    "text",
                    "text",
                    "numeric",
                    "text",
                  ]}
                  headings={[
                    "Transaction ID",
                    "Date",
                    "Customer",
                    "Amount",
                    "Status",
                  ]}
                  rows={rows}
                />
              </Box>
              <Box padding="400">
                <ButtonGroup>
                  <Button>Export</Button>
                  <Button variant="primary">Refresh</Button>
                </ButtonGroup>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
